// [bd-file:store]
import { html, type Raw } from "../../html";

/**
 * The store's filters live in the URL (?q, ?category, ?priceMin, ?priceMax,
 * ?rating, ?sort): the facets are links and the search, price and sort are
 * GET forms, so they work without JavaScript; with it, htmx (`SWAP`) fetches
 * the new list and swaps just the layout, keeping the URL in step.
 */

export const SORTS = [
	{ value: "featured", label: "Featured" },
	{ value: "newest", label: "Newest" },
	{ value: "price-asc", label: "Price: low to high" },
	{ value: "price-desc", label: "Price: high to low" },
	{ value: "rating-desc", label: "Top rated" },
] as const;
export type Sort = (typeof SORTS)[number]["value"];

/** The keys that filter the list (sort only orders it). */
export const FILTER_KEYS = ["q", "category", "priceMin", "priceMax", "rating"];

/** On the filters: htmx fetches the new list and swaps only the layout (#store-layout). */
export const SWAP = html`hx-boost="true" hx-target="#store-layout" hx-select="#store-layout" hx-swap="outerHTML"`;

/** Whether any filter is on. */
export function hasFilters(params: URLSearchParams): boolean {
	return FILTER_KEYS.some((key) => params.get(key));
}

/** The chosen sort; "featured" when none or an unknown one. */
export function sortOf(params: URLSearchParams): Sort {
	const raw = params.get("sort");
	return SORTS.find((s) => s.value === raw)?.value ?? "featured";
}

/** The chosen minimum rating, 0 for none. */
export function ratingOf(params: URLSearchParams): number {
	const raw = Number.parseInt(params.get("rating") ?? "", 10);
	return raw >= 1 && raw <= 5 ? raw : 0;
}

/** This list with some filters changed (null removes one). */
export function hrefWith(params: URLSearchParams, changes: Record<string, string | null>, storeHref = "/store"): string {
	const next = new URLSearchParams(params);
	for (const [key, value] of Object.entries(changes)) {
		if (value === null || value === "") next.delete(key);
		else next.set(key, value);
	}
	const query = next.toString();
	return query ? `${storeHref}?${query}` : storeHref;
}

/** The filters a form leaves alone, carried along as hidden fields. */
export function keep(params: URLSearchParams, ...replaced: string[]): Raw[] {
	return [...params]
		.filter(([key]) => !replaced.includes(key))
		.map(([name, value]) => html`<input type="hidden" name="${name}" value="${value}" />`);
}
