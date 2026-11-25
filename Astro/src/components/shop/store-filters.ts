// [bd-file:store]
/**
 * The store's filters live in the URL (?q, ?category, ?min, ?max, ?rating,
 * ?sort): the facets are links and the search, price and sort are plain GET
 * forms, so the store works without JavaScript, a filtered list can be
 * shared and the back button steps through filters. These read and change
 * them for the filter parts (StoreSearch, CategoryFilter, PriceFilter,
 * RatingFilter, ClearFilters, SortSelect).
 */

export const SORTS = [
	{ value: "featured", label: "Featured" },
	{ value: "newest", label: "Newest" },
	{ value: "price-asc", label: "Price: low to high" },
	{ value: "price-desc", label: "Price: high to low" },
	{ value: "rating-desc", label: "Top rated" },
] as const;
export type Sort = (typeof SORTS)[number]["value"];

/** The filters that narrow the list (sort only orders it). */
export const FILTER_KEYS = ["q", "category", "min", "max", "rating"] as const;

/** Whether any filter is set. */
export function hasFilters(params: URLSearchParams): boolean {
	return FILTER_KEYS.some((key) => params.get(key));
}

/** The chosen sort, Featured unless the URL names another. */
export function sortOf(params: URLSearchParams): Sort {
	const raw = params.get("sort");
	return SORTS.some((s) => s.value === raw) ? (raw as Sort) : "featured";
}

/** The list with some filters changed (null removes one). */
export function hrefWith(
	params: URLSearchParams,
	changes: Record<string, string | null>,
	storeHref = "/store",
): string {
	const next = new URLSearchParams(params);
	for (const [key, value] of Object.entries(changes)) {
		if (value === null || value === "") next.delete(key);
		else next.set(key, value);
	}
	const qs = next.toString();
	return qs ? `${storeHref}?${qs}` : storeHref;
}

/** The filters a form leaves alone, carried along as hidden fields. */
export function keep(params: URLSearchParams, ...replaced: string[]): [string, string][] {
	return [...params].filter(([key]) => !replaced.includes(key));
}
