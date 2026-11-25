// [bd-file:store]
import { el } from "/bd.js";
import { keep } from "./store-filters.js";

/** The search box (?q), a GET form that keeps the other filters. */
export function storeSearch(params, { storeHref = "/store" } = {}) {
	return el("form", { action: storeHref, method: "get" }, [
		el("label", { class: "bd-label", for: "store-search" }, ["Search"]),
		el("input", {
			autocomplete: "off",
			class: "bd-input",
			id: "store-search",
			name: "q",
			placeholder: "Search products…",
			type: "search",
			value: params.get("q") ?? "",
		}),
		...keep(params, "q"),
	]);
}
