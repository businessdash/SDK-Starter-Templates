// [bd-file:store]
import { el } from "/bd.js";
import { keep, SORTS, sortOf } from "./store-filters.js";

/** Featured, Newest, Price either way, Top rated (?sort): a GET form that applies as soon as it changes. */
export function sortSelect(params, { storeHref = "/store" } = {}) {
	const sort = sortOf(params);
	const select = el(
		"select",
		{ class: "bd-select", id: "store-sort", name: "sort" },
		SORTS.map((s) => el("option", { value: s.value, selected: s.value === sort }, [s.label])),
	);
	select.addEventListener("change", () => select.form?.requestSubmit());
	return el("form", { action: storeHref, class: "store-sort", method: "get" }, [
		el("label", { for: "store-sort" }, ["Sort"]),
		select,
		...keep(params, "sort"),
	]);
}
