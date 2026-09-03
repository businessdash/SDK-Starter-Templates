import type { GetMarketingPageBundleResponse } from "@businessdash/sdk";

import { bd } from "./bd";

/**
 * Marketing-bundle helpers — fetch the page bundle once and pull the
 * runtime-only extras off it (banner + updates feed + the first page of
 * reviews). Mirrors the DGP reference (`src/lib/bd.ts`) but trimmed for a
 * single-locale starter.
 *
 * `bundle.banner` and `bundle.updates` are untyped passthroughs at SDK 0.9.5
 * — the contract already defines them, so we mirror the shapes locally and
 * read them off the bundle. When the SDK ships the types these can be swapped
 * for the SDK exports with no call-site change.
 *
 * Every helper returns a graceful empty/null value when BD env is unset so
 * the page renders local fallbacks instead of crashing.
 */

export type MarketingBundle = GetMarketingPageBundleResponse;

// ── bundle.banner (multi-message announcement strip) ──
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
	everyIntervalHours?: number;
	scheduleActive?: boolean;
	displayFromUtc?: string | null;
	displayUntilUtc?: string | null;
};

export type BundleBanner = {
	enabled: boolean;
	hiddenOnHome: boolean;
	messages: BundleBannerMessage[];
};

// ── bundle.updates (Google-Business-style posts feed) ──
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

export type BundleUpdates = {
	items: BundleUpdateItem[];
};

// ── Reviews off the bundle (aggregate + first page) ──
export type BundleReviews = NonNullable<MarketingBundle["reviews"]>;

/**
 * Fetch the home (or any) page bundle. Returns `null` when BD is
 * unconfigured or the call fails — callers fall back to local content.
 */
export async function getBundle(
	pageKey = "home",
	locale = "en",
): Promise<MarketingBundle | null> {
	if (!bd) return null;
	try {
		return (await bd.marketing.getPageBundle({
			pageKey,
			locale,
		})) as MarketingBundle;
	} catch {
		return null;
	}
}

/** Marketing banner off the bundle (`null` until the org enables one). */
export function getBannerFromBundle(
	bundle: MarketingBundle | null,
): BundleBanner | null {
	const banner = (bundle as unknown as { banner?: BundleBanner | null } | null)
		?.banner;
	if (!banner || !banner.enabled) return null;
	const messages = (banner.messages ?? []).filter((m) => m.enabled);
	if (messages.length === 0) return null;
	return { ...banner, messages };
}

/** Updates feed off the bundle (empty until the org has cached posts). */
export function getUpdatesFromBundle(
	bundle: MarketingBundle | null,
): BundleUpdateItem[] {
	const updates = (
		bundle as unknown as { updates?: BundleUpdates | null } | null
	)?.updates;
	return updates?.items ?? [];
}

/** Org reviews off the bundle: aggregate + first page (`null` until any exist). */
export function getReviewsFromBundle(
	bundle: MarketingBundle | null,
): BundleReviews | null {
	return bundle?.reviews ?? null;
}
