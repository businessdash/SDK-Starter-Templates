// [bd-file:store]
import { el } from "/bd.js";

/** Details: the feature list, then a table per spec group. */
export function productSpecs({ features, specs }) {
	if (features.length === 0 && specs.length === 0) return null;
	return el("section", { class: "product-section", id: "specs" }, [
		el("h2", { class: "product-section__title" }, ["Details"]),
		features.length > 0
			? el(
					"ul",
					{ class: "features" },
					features.map((feature) => el("li", {}, [feature])),
				)
			: null,
		...specs.map((group) =>
			el("table", { class: "specs" }, [
				el("caption", {}, [group.name]),
				el(
					"tbody",
					{},
					group.rows.map((row) =>
						el("tr", {}, [el("th", { scope: "row" }, [row.label]), el("td", {}, [row.value])]),
					),
				),
			]),
		),
	]);
}
