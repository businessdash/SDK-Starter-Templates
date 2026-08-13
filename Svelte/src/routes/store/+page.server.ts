import type { StorefrontSort } from "@businessdash/sdk/contracts";

import type { PageServerLoad } from "./$types";

import {
	getCartSnapshot,
	isStoreConfigured,
	listStoreCategories,
	listStoreProductsWithMeta,
} from "$lib/server/biab-store";

/**
 * Storefront index. Lists products via `storefront.listProductsWithMeta`
 * with facet data (categoryCounts, priceRange) for the sidebar, joined
 * against `storefront.listCategories` for category names. Filters are
 * driven entirely by URL search params (?q, ?category, ?price, ?rating,
 * ?sort) so the grid is shareable/bookmarkable and stays on the server.
 *
 * Reports the current cart count read-only (never mints the visitor
 * cookie here). Renders an "not connected" placeholder when BIAB env is
 * unset, matching the rest of the template's graceful-degradation pattern.
 */

const SORTS: readonly StorefrontSort[] = [
	"featured",
	"newest",
	"price-asc",
	"price-desc",
	"rating-desc",
];

const EMPTY_META = {
	items: [],
	categoryCounts: [],
	priceRange: { minDollars: 0, maxDollars: 0 },
} as const;

export const load: PageServerLoad = async ({ url, cookies }) => {
	const search = url.searchParams.get("q")?.trim() || undefined;
	const categoryId = url.searchParams.get("category") || undefined;

	const sortRaw = url.searchParams.get("sort") ?? "";
	const sort: StorefrontSort = SORTS.includes(sortRaw as StorefrontSort)
		? (sortRaw as StorefrontSort)
		: "featured";

	const ratingRaw = Number.parseInt(url.searchParams.get("rating") ?? "", 10);
	const minRating =
		Number.isFinite(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5
			? ratingRaw
			: undefined;

	const [minDollarsRaw, maxDollarsRaw] = (url.searchParams.get("price") ?? "")
		.split("-")
		.map((n) => Number.parseInt(n, 10));
	const minDollars = Number.isFinite(minDollarsRaw) ? minDollarsRaw : undefined;
	const maxDollars = Number.isFinite(maxDollarsRaw) ? maxDollarsRaw : undefined;

	const filters = {
		search,
		categoryId,
		sort,
		minRating,
		minDollars,
		maxDollars,
	};

	if (!isStoreConfigured()) {
		return {
			configured: false as const,
			meta: EMPTY_META,
			categories: [] as Array<{ id: string; name: string }>,
			filters,
			cartCount: 0,
		};
	}

	const [meta, cats, cart] = await Promise.all([
		listStoreProductsWithMeta({
			search,
			categoryId,
			minRating,
			minPriceCents: minDollars != null ? minDollars * 100 : undefined,
			maxPriceCents: maxDollars != null ? maxDollars * 100 : undefined,
			sort,
			limit: 50,
		}),
		listStoreCategories(),
		getCartSnapshot(cookies),
	]);

	return {
		configured: true as const,
		meta: meta ?? EMPTY_META,
		categories: (cats?.items ?? []).map((c) => ({ id: c.id, name: c.name })),
		filters,
		cartCount: cart?.itemCount ?? 0,
	};
};
