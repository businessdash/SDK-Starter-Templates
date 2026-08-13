import "server-only";

import {
	type BiabClient,
	BiabPaymentLapsedError,
	BiabServiceSuspendedError,
	createBiabClient,
} from "@businessdash/sdk";

import { env } from "@/env";

/**
 * Server-only BIAB client. The `server-only` import at the top of
 * this file makes Next throw a build error if any client component
 * imports it — the bearer key is guaranteed to never reach the
 * browser bundle.
 *
 * Returns `null` when env isn't configured so callers can render
 * local fallbacks instead of crashing the page.
 */

function normalizeBaseUrl(input: string): string {
	const next = input.trim().replace(/\/$/, "");
	if (next.endsWith("/api/package/v1")) return next;
	return `${next}/api/package/v1`;
}

/**
 * Long ISR backstop in seconds. On-demand webhook invalidation
 * (mounted at `/api/biab/revalidate`) handles freshness; this
 * backstop only catches a missed webhook delivery — once a day is
 * enough self-healing. In dev we never cache so edits in BIAB show
 * up on a plain refresh.
 */
const BACKSTOP_REVALIDATE_SECONDS = 60 * 60 * 24; // 24h

/** How many review bodies the marketing bundle ships eagerly. The rest are
 *  pulled lazily via `client.reviews.list(...)` on "load more". */
const REVIEWS_FIRST_PAGE = 10;

let cached: BiabClient | null | undefined;

export function getBiab(): BiabClient | null {
	if (cached !== undefined) return cached;
	const apiKey = env.BIAB_API_KEY;
	// SITE_ID + base URL aren't secret; the canonical vars are the NEXT_PUBLIC_
	// twins (the browser needs them too). Fall back to the legacy server-only
	// names so already-deployed apps keep working.
	const siteId = env.NEXT_PUBLIC_BIAB_SITE_ID ?? env.BIAB_SITE_ID;
	const baseUrl =
		env.NEXT_PUBLIC_BIAB_PACKAGE_API_BASE_URL ?? env.BIAB_PACKAGE_API_BASE_URL;
	if (!apiKey || !siteId || !baseUrl) {
		cached = null;
		return cached;
	}
	const isDev = env.NODE_ENV === "development";
	cached = createBiabClient({
		apiKey,
		siteId,
		baseUrl: normalizeBaseUrl(baseUrl),
		revalidateSeconds: BACKSTOP_REVALIDATE_SECONDS,
		// Dev: always fetch fresh. Prod: rely on the SDK's tags + the webhook to
		// invalidate, with the long backstop as a self-heal.
		// We override the SDK's `next.revalidate` hint with `0` (rather than adding
		// `cache: "no-store"` on top) so Next doesn't warn that both a cache mode
		// and a revalidate are set on the same fetch.
		fetch: isDev
			? (input, init) =>
					globalThis.fetch(input, { ...init, next: { revalidate: 0 } })
			: undefined,
	});
	return cached;
}

/** True when the BIAB env is wired up (lets the UI show a graceful
 *  "not connected" state instead of crashing). */
export function isBiabConfigured(): boolean {
	return getBiab() !== null;
}

// ── Suspension handling ─────────────────────────────────────────────
//
// `BiabPaymentLapsedError` (billing lapsed) and `BiabServiceSuspendedError`
// (fully suspended) both extend `BiabAccessRejectedError`. Wrap any read that
// can hit a suspended org so the page can render a minimal "site unavailable"
// state instead of a stack trace.

export class SiteUnavailableError extends Error {
	constructor(
		message: string,
		readonly reason: "payment-lapsed" | "service-suspended",
	) {
		super(message);
		this.name = "SiteUnavailableError";
	}
}

/** Run an SDK read, converting suspension errors into `SiteUnavailableError`
 *  and any other error into `fallback`. */
export async function readOrUnavailable<T>(
	fn: () => Promise<T>,
	fallback: T,
): Promise<T> {
	try {
		return await fn();
	} catch (err) {
		if (err instanceof BiabServiceSuspendedError) {
			throw new SiteUnavailableError(
				"This site is temporarily unavailable.",
				"service-suspended",
			);
		}
		if (err instanceof BiabPaymentLapsedError) {
			throw new SiteUnavailableError(
				"This site is temporarily unavailable.",
				"payment-lapsed",
			);
		}
		if (env.NODE_ENV === "development") {
			const reason = err instanceof Error ? err.message : String(err);
			console.warn(`[biab] read failed — using fallback. ${reason}`);
		}
		return fallback;
	}
}

// ── Marketing bundle (banner + updates + reviews ride along) ─────────
//
// SDK 0.9.5 ships `bundle.banner` (multi-message news bar) and `bundle.updates`
// (Google-Business-style posts feed) as untyped passthroughs, so we mirror the
// contract locally and read them defensively. Reviews aggregate + first page
// come back as `bundle.reviews`.

export type BundleBannerMessage = {
	id: string;
	enabled: boolean;
	text: string;
	linkUrl?: string;
	buttonText?: string;
	openInNewTab?: boolean;
	urgent?: boolean;
};

export type BundleBanner = {
	enabled: boolean;
	hiddenOnHome?: boolean;
	messages: BundleBannerMessage[];
};

export type BundleUpdateItem = {
	id: string;
	kind: string | null;
	title: string | null;
	body: string;
	link: string | null;
	imageUrl: string | null;
	images: string[];
	postedAt: string | null;
};

export type BundleReviewItem = {
	id: string;
	reviewee: string;
	rating: number;
	image: string | null;
	description: string;
	date: string;
	platform: string;
};

export type BundleReviews = {
	rating: number | null;
	totalCount: number | null;
	items: BundleReviewItem[];
};

/** Marketing bundle as a loose record — the SDK's `getPageBundle` predates the
 *  typed banner/updates fields, so we read those via passthrough. */
export type MarketingBundle = Record<string, unknown> & {
	sections?: Record<string, unknown>;
};

/**
 * Fetch a marketing page bundle. Wrapped in `readOrUnavailable` so a suspended
 * org surfaces a "site unavailable" state. Returns `null` (not throws) for the
 * unconfigured / transient-error case so callers fall back to local content.
 */
export async function getBiabBundle(
	pageKey: string,
	locale = "en",
): Promise<MarketingBundle | null> {
	const biab = getBiab();
	if (!biab) return null;
	return readOrUnavailable<MarketingBundle | null>(
		() =>
			biab.marketing.getPageBundle({
				pageKey,
				locale,
				reviewsLimit: REVIEWS_FIRST_PAGE,
			}) as Promise<MarketingBundle>,
		null,
	);
}

/** Read one schema section's `data` from a bundle, or `null` when missing /
 *  unparsed. Mirrors the existing `readSection` helper in the tRPC router. */
export function readBundleSection(
	bundle: MarketingBundle | null,
	name: string,
): Record<string, unknown> | null {
	const raw = bundle?.sections?.[name];
	if (
		raw &&
		typeof raw === "object" &&
		"ok" in raw &&
		(raw as { ok: boolean }).ok
	) {
		return (raw as unknown as { data: Record<string, unknown> }).data;
	}
	return null;
}

/** News banner off the bundle (`null` until the org enables one). */
export function getBannerFromBundle(
	bundle: MarketingBundle | null,
): BundleBanner | null {
	const banner = (bundle as { banner?: BundleBanner | null } | null)?.banner;
	if (!banner?.enabled) return null;
	const messages = (banner.messages ?? []).filter((m) => m.enabled);
	if (messages.length === 0) return null;
	return { ...banner, messages };
}

/** Updates feed off the bundle (empty until the org has cached Google posts). */
export function getUpdatesFromBundle(
	bundle: MarketingBundle | null,
): BundleUpdateItem[] {
	const updates = (
		bundle as { updates?: { items?: BundleUpdateItem[] } | null } | null
	)?.updates;
	return updates?.items ?? [];
}

/** Reviews aggregate + first page off the bundle (`null` until the org has
 *  at least one review). */
export function getReviewsFromBundle(
	bundle: MarketingBundle | null,
): BundleReviews | null {
	const reviews = (
		bundle as {
			reviews?: (BundleReviews & { enabled?: boolean }) | null;
		} | null
	)?.reviews;
	if (!reviews) return null;
	return {
		rating: reviews.rating ?? null,
		totalCount: reviews.totalCount ?? null,
		items: reviews.items ?? [],
	};
}
