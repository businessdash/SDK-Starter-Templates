import type { GetMarketingPageBundleResponse } from "@businessdash/sdk";
import type { BundleBanner } from "@businessdash/sdk/contracts";

import { cached } from "./biab-cache.server";
import { getBiab, isSuspensionError } from "./biab.server";

/**
 * `bundle.updates` (cached Google-Business "Posts" feed) lands as an untyped
 * passthrough at SDK 0.9.5 — the bundle response only types it from 0.9.6 on.
 * Mirror its contract locally and read it via passthrough, the same way the
 * reference consumer does. When the installed SDK ships `BundleUpdates`, this
 * can be replaced by the SDK export with no call-site changes.
 */
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

type BundleUpdates = { items: BundleUpdateItem[] };

/**
 * Single source of truth for the marketing page bundle (server-only).
 *
 * The bundle is one round-trip that carries the page's sections plus the
 * cross-cutting extras every starter surface needs: the news banner, the
 * updates feed, the project-media gallery, the reviews aggregate, and the
 * company profile. Routes call `getMarketingBundle()` once and pull the
 * slice they need with the extraction helpers below.
 *
 * It's memoised through the tag-keyed in-memory cache so the BIAB
 * revalidation webhook (`/api/biab/revalidate`) can bust it on publish.
 * The same tags the webhook fires are the ones we key on here.
 */

export type MarketingBundle = GetMarketingPageBundleResponse;

// These bundle slices aren't exported as standalone types, so derive them
// from the response (the same pattern the reference consumer uses).
export type BundleGallery = NonNullable<MarketingBundle["gallery"]>;
export type BundleReviews = NonNullable<MarketingBundle["reviews"]>;

/** First-page review bodies the bundle ships eagerly; deeper pages come
 *  from `client.reviews.list({ offset })` via `/api/reviews`. */
const REVIEWS_FIRST_PAGE = 10;

const BUNDLE_TAGS = [
	"biab:marketing",
	"biab:marketing:home",
	"biab:gallery",
	"biab:reviews",
	"biab:catalog",
	"biab:banner",
	"biab:updates",
];

/**
 * Fetch + cache the `home`/`en` marketing bundle. Returns `null` when BIAB
 * isn't configured (callers fall back to local seeds) or when the org's
 * service is fully suspended (callers can render a minimal unavailable
 * state). Any other error degrades to `null` so the page still renders.
 */
export async function getMarketingBundle(
	pageKey = "home",
): Promise<MarketingBundle | null> {
	const biab = getBiab();
	if (!biab) return null;
	try {
		return await cached(`biab:bundle:${pageKey}:en`, BUNDLE_TAGS, () =>
			biab.marketing.getPageBundle({
				pageKey,
				locale: "en",
				reviewsLimit: REVIEWS_FIRST_PAGE,
			}),
		);
	} catch (err) {
		if (isSuspensionError(err)) throw err; // let the route render "unavailable"
		if (process.env.NODE_ENV === "development") {
			const reason = err instanceof Error ? err.message : String(err);
			console.warn(`[biab] getPageBundle(${pageKey}) failed: ${reason}`);
		}
		return null;
	}
}

// ── Bundle slice extractors (each maps the bundle's own shape) ─────────

/** News banner off the bundle (`null` until the org enables one with a
 *  visible message). `bundle.banner` is typed at 0.9.6. */
export function getBannerFromBundle(
	bundle: MarketingBundle | null,
): BundleBanner {
	return bundle?.banner ?? null;
}

/** Updates feed (cached Google Business "Posts") off the bundle. Returns
 *  `[]` until the org has any. */
export function getUpdatesFromBundle(
	bundle: MarketingBundle | null,
): BundleUpdateItem[] {
	const updates = (bundle as unknown as { updates?: BundleUpdates | null } | null)
		?.updates;
	return updates?.items ?? [];
}

/** Public project-media gallery off the bundle (`null` until items are
 *  tagged "Show in public gallery"). */
export function getGalleryFromBundle(
	bundle: MarketingBundle | null,
): BundleGallery | null {
	return bundle?.gallery ?? null;
}

/** Reviews aggregate + first page off the bundle. NOTE: these bundle items
 *  have shape `{ reviewee, description, date, rating }` — the reviews-WALL
 *  items from `client.reviews.list(...)` use `{ reviewerName, text,
 *  timeCreated, rating }` instead, so map each at its own call site. */
export function getReviewsFromBundle(
	bundle: MarketingBundle | null,
): BundleReviews | null {
	return bundle?.reviews ?? null;
}

/** Read one section's parsed data off the bundle (untyped — the SDK
 *  validates the section payloads against `biab.config.ts` on the host
 *  side; here we read the already-resolved data defensively). */
export function getSectionData(
	bundle: MarketingBundle | null,
	key: string,
): Record<string, unknown> | null {
	const raw = bundle?.sections?.[key];
	if (raw && raw.ok) {
		return (raw.data ?? null) as Record<string, unknown> | null;
	}
	return null;
}
