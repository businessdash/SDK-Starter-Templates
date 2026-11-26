// [bd-file:store]
/** The store's sorts and the URL filters the parts in `StoreFilters.tsx` read. */

export const SORTS = [
	{ value: "featured", label: "Featured" },
	{ value: "newest", label: "Newest" },
	{ value: "price-asc", label: "Price: low to high" },
	{ value: "price-desc", label: "Price: high to low" },
	{ value: "rating-desc", label: "Top rated" },
] as const;

export type Sort = (typeof SORTS)[number]["value"];

export function parseSort(raw: string | null): Sort {
	return SORTS.some((s) => s.value === raw) ? (raw as Sort) : "featured";
}

/** The ?rating filter: 1 to 5 stars, or undefined. */
export function parseRating(raw: string | null): number | undefined {
	const rating = Number.parseInt(raw ?? "", 10);
	return rating >= 1 && rating <= 5 ? rating : undefined;
}

/** True when the list is narrowed by any filter (sort isn't one). */
export function hasFilters(params: URLSearchParams): boolean {
	return ["q", "category", "min", "max", "rating"].some((key) => params.get(key));
}
