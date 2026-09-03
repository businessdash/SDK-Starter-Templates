/**
 * Server-only helpers for the runtime-delivered bundle extras
 * (`banner`, `updates`), the reviews wall, and JSON-LD.
 *
 * `bundle.banner` (multi-message announcement bar) and `bundle.updates`
 * (Google-Business-style posts feed) ride the marketing bundle as
 * untyped passthroughs at 0.9.5, so we mirror their shapes locally and
 * read them defensively — same pattern DGP-2026 uses. When the SDK ships
 * typed exports these local types can be dropped with no call-site change.
 */

import type { ReviewWallListResponse } from "@businessdash/sdk/contracts";
import { localBusiness, website } from "@businessdash/sdk/seo";

import { getBd } from "./bd";

// ── bundle.banner ──────────────────────────────────────────────────
export type BundleBannerMessage = {
	id: string;
	enabled: boolean;
	text: string;
	linkUrl: string;
	buttonText: string;
	openInNewTab: boolean;
	linkStyle?: "link" | "button";
	urgent?: boolean;
};

export type BundleBanner = {
	enabled: boolean;
	hiddenOnHome: boolean;
	messages: BundleBannerMessage[];
};

// ── bundle.updates ─────────────────────────────────────────────────
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

/** Banner off the bundle (`null` until the org enables one with active messages). */
export function getBannerFromBundle(bundle: unknown): BundleBanner | null {
	const banner = (bundle as { banner?: BundleBanner | null } | null)?.banner;
	if (!banner || !banner.enabled) return null;
	const messages = (banner.messages ?? []).filter((m) => m?.enabled);
	if (messages.length === 0) return null;
	return { ...banner, messages };
}

/** Updates feed off the bundle (empty until the org has cached posts). */
export function getUpdatesFromBundle(bundle: unknown): BundleUpdateItem[] {
	const updates = (
		bundle as { updates?: { items?: BundleUpdateItem[] } | null } | null
	)?.updates;
	return updates?.items ?? [];
}

/** The org-reviews aggregate the bundle ships eagerly (count + average). */
export type BundleReviewsAggregate = {
	average: number | null;
	count: number;
};

export function getReviewsAggregateFromBundle(
	bundle: unknown,
): BundleReviewsAggregate {
	const reviews = (
		bundle as {
			reviews?: { average?: number; count?: number; total?: number } | null;
		} | null
	)?.reviews;
	return {
		average: typeof reviews?.average === "number" ? reviews.average : null,
		count:
			typeof reviews?.count === "number"
				? reviews.count
				: typeof reviews?.total === "number"
					? reviews.total
					: 0,
	};
}

/**
 * Fetch one page of the public reviews wall (server-only — uses the secret
 * key). Returns `null` when unconfigured or the call fails, so the caller can
 * stop paginating gracefully.
 */
export async function fetchReviewsPage(input?: {
	limit?: number;
	offset?: number;
	source?: "google" | "yelp" | "housecall_pro" | "other";
}): Promise<ReviewWallListResponse | null> {
	const bd = getBd();
	if (!bd) return null;
	try {
		return await bd.reviews.list(input);
	} catch {
		return null;
	}
}

// ── JSON-LD ────────────────────────────────────────────────────────

export type SiteIdentity = {
	name: string;
	siteUrl: string;
	description?: string;
	telephone?: string;
	email?: string;
};

/**
 * Build the `localBusiness` + `website` JSON-LD graph and serialize the node
 * array to a JSON string. The home page's `head.scripts` entry renders this
 * server-side as the inner content of a single
 * `<script type="application/ld+json">` tag (Qwik's RouterHead emits the
 * `<script>` element; we only supply the body + the `type` prop).
 */
export function buildSiteJsonLd(identity: SiteIdentity): string {
	const nodes = [
		localBusiness({
			siteUrl: identity.siteUrl,
			name: identity.name,
			description: identity.description,
			telephone: identity.telephone,
			email: identity.email,
		}),
		website({
			siteUrl: identity.siteUrl,
			name: identity.name,
			description: identity.description,
		}),
	];
	return JSON.stringify(nodes);
}
