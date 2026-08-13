import { env } from "$env/dynamic/private";

import {
	BiabPaymentLapsedError,
	BiabServiceSuspendedError,
} from "@businessdash/sdk";
import type { GetMarketingPageBundleResponse } from "@businessdash/sdk";

import { biab } from "$lib/server/biab";

/**
 * Marketing-bundle helpers shared by the page loads.
 *
 * The bundle carries more than the typed sections: at 0.9.5 the
 * `banner` (scheduled announcement strip) and `updates` (Google-Business
 * "Posts" feed) ride along as untyped passthroughs, and `reviews` ships
 * the aggregate + first page. We mirror those shapes locally and read
 * them defensively so the starter keeps compiling when the SDK later
 * types them.
 *
 * `fetchBundleSafe` also recognises the billing-suspension errors so a
 * page load can render a minimal "site unavailable" state instead of a
 * hard 500.
 */

// ── bundle.banner (untyped passthrough) ──────────────────────────────
export type BundleBannerMessage = {
	id: string;
	enabled: boolean;
	text: string;
	marqueeLines?: string[];
	linkUrl: string;
	buttonText: string;
	openInNewTab: boolean;
	linkStyle?: "link" | "button";
	urgent?: boolean;
	appearance: "always" | "once" | "until_dismiss" | "every";
};

export type BundleBanner = {
	enabled: boolean;
	hiddenOnHome: boolean;
	messages: BundleBannerMessage[];
};

// ── bundle.updates (untyped passthrough) ─────────────────────────────
export type BundleUpdateItem = {
	id: string;
	kind: string | null;
	title: string | null;
	body: string;
	link: string | null;
	imageUrl: string | null;
	images: string[];
	postedAt: string | null;
	startsAt: string | null;
	endsAt: string | null;
};

// ── bundle.reviews aggregate + first page ────────────────────────────
export type BundleReviewItem = {
	reviewee: string;
	rating: number;
	description: string;
	date: string;
	platform: string;
};

export type BundleReviews = {
	rating: number | null;
	totalCount: number | null;
	returnedCount?: number;
	items: BundleReviewItem[];
};

export type BundleResult =
	| { status: "ok"; bundle: GetMarketingPageBundleResponse | null }
	| { status: "unavailable"; reason: "lapsed" | "suspended" };

/**
 * Fetch a marketing-page bundle, translating the billing-suspension
 * errors into a structured "unavailable" result. Any other error (or an
 * unconfigured client) resolves to `{ status: "ok", bundle: null }` so
 * the caller falls back to placeholder content.
 */
export async function fetchBundleSafe(
	pageKey = "home",
	locale = "en",
): Promise<BundleResult> {
	if (!biab) return { status: "ok", bundle: null };
	try {
		const bundle = await biab.marketing.getPageBundle({ pageKey, locale });
		return { status: "ok", bundle };
	} catch (err) {
		if (err instanceof BiabServiceSuspendedError) {
			return { status: "unavailable", reason: "suspended" };
		}
		if (err instanceof BiabPaymentLapsedError) {
			return { status: "unavailable", reason: "lapsed" };
		}
		if (env.NODE_ENV === "development") {
			console.warn(
				`[biab] getPageBundle(${pageKey}) failed: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
		return { status: "ok", bundle: null };
	}
}

/** Read a typed-but-passthrough section's `data`, or null. */
export function readSection(
	bundle: GetMarketingPageBundleResponse | null,
	name: string,
): Record<string, unknown> | null {
	const raw = (bundle as { sections?: Record<string, unknown> } | null)
		?.sections?.[name];
	if (raw && typeof raw === "object" && "ok" in raw && (raw as { ok: boolean }).ok) {
		return (raw as unknown as { data: Record<string, unknown> }).data;
	}
	return null;
}

/** Banner off the bundle (`null` until the org enables one with messages). */
export function getBannerFromBundle(
	bundle: GetMarketingPageBundleResponse | null,
): BundleBanner | null {
	const banner = (bundle as unknown as { banner?: BundleBanner | null } | null)
		?.banner;
	if (!banner?.enabled) return null;
	const messages = (banner.messages ?? []).filter((m) => m.enabled);
	if (messages.length === 0) return null;
	return { ...banner, messages };
}

/** Updates feed off the bundle (empty until the org has cached Google posts). */
export function getUpdatesFromBundle(
	bundle: GetMarketingPageBundleResponse | null,
): BundleUpdateItem[] {
	const updates = (
		bundle as unknown as { updates?: { items?: BundleUpdateItem[] } | null } | null
	)?.updates;
	return updates?.items ?? [];
}

/** Reviews aggregate + first page off the bundle (`null` until any exist). */
export function getReviewsFromBundle(
	bundle: GetMarketingPageBundleResponse | null,
): BundleReviews | null {
	const reviews = (bundle as { reviews?: BundleReviews | null } | null)?.reviews;
	return reviews ?? null;
}
