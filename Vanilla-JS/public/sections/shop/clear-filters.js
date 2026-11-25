// [bd-file:store]
import { el } from "/bd.js";

/** Clear all filters: the store with none. */
export function clearFilters({ storeHref = "/store" } = {}) {
	return el("a", { class: "store-clear", href: storeHref }, ["Clear all filters"]);
}
