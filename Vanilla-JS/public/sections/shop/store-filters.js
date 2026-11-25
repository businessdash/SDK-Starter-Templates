// [bd-file:store]
import { el } from "/bd.js";

/**
 * The store's filters live in the URL (?q, ?category, ?min, ?max, ?rating,
 * ?sort), so a filtered list can be shared and the back button steps
 * through filters. The filter parts are links and GET forms built with
 * these.
 */

export const SORTS = [
	{ value: "featured", label: "Featured" },
	{ value: "newest", label: "Newest" },
	{ value: "price-asc", label: "Price: low to high" },
	{ value: "price-desc", label: "Price: high to low" },
	{ value: "rating-desc", label: "Top rated" },
];

/** The keys that filter the list (sort only orders it). */
export const FILTER_KEYS = ["q", "category", "min", "max", "rating"];

/** Whether any filter is on. */
export function hasFilters(params) {
	return FILTER_KEYS.some((key) => params.get(key));
}

/** The chosen sort; "featured" when none or an unknown one. */
export function sortOf(params) {
	const raw = params.get("sort");
	return SORTS.some((s) => s.value === raw) ? raw : "featured";
}

/** This list with some filters changed (null removes one). */
export function hrefWith(params, changes, storeHref = "/store") {
	const next = new URLSearchParams(params);
	for (const [key, value] of Object.entries(changes)) {
		if (value === null || value === "") next.delete(key);
		else next.set(key, value);
	}
	const qs = next.toString();
	return qs ? `${storeHref}?${qs}` : storeHref;
}

/** The filters a form leaves alone, carried along as hidden fields. */
export function keep(params, ...replaced) {
	return [...params]
		.filter(([key]) => !replaced.includes(key))
		.map(([name, value]) => el("input", { type: "hidden", name, value }));
}
