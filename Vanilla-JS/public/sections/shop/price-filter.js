// [bd-file:store]
import { el } from "/bd.js";
import { keep } from "./store-filters.js";

/**
 * Lowest and highest price in dollars (?min, ?max) with Apply, a GET form.
 * `priceRange` ({ minDollars, maxDollars }) is what the store's products cost.
 */
export function priceFilter(params, priceRange, { storeHref = "/store" } = {}) {
	return el("form", { action: storeHref, class: "store-facet", method: "get" }, [
		el("p", { class: "store-facet__title" }, ["Price"]),
		el("div", { class: "store-price" }, [
			el("input", {
				"aria-label": "Lowest price",
				class: "bd-input",
				inputmode: "decimal",
				name: "min",
				placeholder: priceRange ? `$${Number(priceRange.minDollars).toFixed(0)}` : "Min",
				value: params.get("min") ?? "",
			}),
			el("span", { "aria-hidden": "true", class: "store-price__sep" }, ["–"]),
			el("input", {
				"aria-label": "Highest price",
				class: "bd-input",
				inputmode: "decimal",
				name: "max",
				placeholder: priceRange ? `$${Number(priceRange.maxDollars).toFixed(0)}` : "Max",
				value: params.get("max") ?? "",
			}),
		]),
		...keep(params, "min", "max"),
		el("button", { class: "bd-btn bd-btn--ghost store-price__apply", type: "submit" }, ["Apply"]),
	]);
}
