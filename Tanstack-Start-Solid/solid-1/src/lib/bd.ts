/**
 * Server-only BD client + bundle helpers. Only imported from
 * `createServerFn` handlers in `bd-server-fns.ts` (and the
 * server-side API routes), so the bearer key never reaches the
 * browser bundle.
 *
 * Returns `null` when env isn't configured so callers can fall
 * back to local defaults instead of crashing the page.
 */

import { type BdClient, createBdClient } from "@businessdash/sdk";

export function normalizeBaseUrl(input: string): string {
	const next = input.trim().replace(/\/+$/, "");
	if (next.endsWith("/api/package/v1")) return next;
	return `${next}/api/package/v1`;
}

let cached: BdClient | null | undefined;

export function getBd(): BdClient | null {
	if (cached !== undefined) return cached;
	const apiKey = process.env.BD_API_KEY;
	// SITE_ID + base URL aren't secret; the canonical vars are the VITE_
	// twins (the browser needs them too). Fall back to the legacy server-only
	// names so already-deployed apps keep working.
	const siteId =
		process.env.VITE_BD_SITE_ID ?? process.env.BD_SITE_ID;
	const baseUrl =
		process.env.VITE_BD_PACKAGE_API_BASE_URL ??
		process.env.BD_PACKAGE_API_BASE_URL;
	if (!apiKey || !siteId || !baseUrl) {
		cached = null;
		return cached;
	}
	cached = createBdClient({
		apiKey,
		siteId,
		baseUrl: normalizeBaseUrl(baseUrl),
	});
	return cached;
}

/** Raw config (apiKey + normalized base URL + siteId) for the few helpers
 *  that hit BD endpoints directly (bundle fetch, sitemap/robots proxy). */
export function bdRawConfig(): {
	apiKey: string;
	siteId: string;
	baseUrl: string;
} | null {
	const apiKey = process.env.BD_API_KEY;
	const siteId =
		process.env.VITE_BD_SITE_ID ?? process.env.BD_SITE_ID;
	const rawBaseUrl =
		process.env.VITE_BD_PACKAGE_API_BASE_URL ??
		process.env.BD_PACKAGE_API_BASE_URL;
	if (!apiKey || !siteId || !rawBaseUrl) return null;
	return { apiKey, siteId, baseUrl: normalizeBaseUrl(rawBaseUrl) };
}

/** Log a short dev-only warning; stays quiet in production. */
export function devwarn(label: string, err: unknown): void {
	if (process.env.NODE_ENV === "development") {
		const reason = err instanceof Error ? err.message : String(err);
		console.warn(`[bd] ${label} failed: ${reason}`);
	}
}

// ── Bundle passthroughs (banner / updates / reviews) ──────────────────
//
// The marketing bundle carries `banner` (scheduled announcement strip),
// `updates` (Google-Business-style posts feed), and `reviews` (aggregate
// + first page). At 0.9.5 `banner`/`updates` are untyped passthroughs,
// so we mirror their shapes locally (same pattern as DGP's bd.ts) and
// read them off the bundle by hand.

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

/** First page of org reviews + aggregate, as shipped on the bundle.
 *  (Bundle review items are `{ reviewee, description, date, rating }`,
 *  distinct from `reviews.list` wall items — map each at its call site.) */
export type BundleReviews = {
	rating: number | null;
	totalCount: number | null;
	items: Array<{
		reviewee: string;
		rating: number;
		description: string;
		date: string;
		platform?: string;
	}>;
};

type RawBundle = Record<string, unknown>;

/**
 * Fetch a marketing page bundle. The high-level client predates the typed
 * resources but still exposes `marketing.getPageBundle` for source-of-truth
 * bundle reads (banner / updates / reviews ride along). Returns `null` when
 * unconfigured or on any error so callers fall back to local content.
 */
export async function getBundle(
	pageKey: string,
	locale = "en",
): Promise<RawBundle | null> {
	const bd = getBd();
	if (!bd) return null;
	try {
		return (await bd.marketing.getPageBundle({
			pageKey,
			locale,
		})) as unknown as RawBundle;
	} catch (err) {
		devwarn(`marketing.getPageBundle(${pageKey})`, err);
		return null;
	}
}

export function getBannerFromBundle(
	bundle: RawBundle | null,
): BundleBanner | null {
	const banner = (bundle as { banner?: BundleBanner | null } | null)?.banner;
	if (!banner || !banner.enabled) return null;
	const messages = (banner.messages ?? []).filter((m) => m.enabled);
	if (messages.length === 0) return null;
	return { ...banner, messages };
}

export function getUpdatesFromBundle(
	bundle: RawBundle | null,
): BundleUpdateItem[] {
	const updates = (
		bundle as { updates?: { items?: BundleUpdateItem[] } | null } | null
	)?.updates;
	return updates?.items ?? [];
}

export function getReviewsFromBundle(
	bundle: RawBundle | null,
): BundleReviews | null {
	const reviews = (bundle as { reviews?: BundleReviews | null } | null)
		?.reviews;
	return reviews ?? null;
}
