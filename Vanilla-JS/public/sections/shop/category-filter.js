// [bd-file:store]
import { el } from "/bd.js";
import { hrefWith } from "./store-filters.js";

/**
 * All products, then each category with how many products it has, as
 * links (?category). `categories` is [{ id, name, count }].
 */
export function categoryFilter(params, categories, { storeHref = "/store" } = {}) {
	if (categories.length === 0) return null;
	const selected = params.get("category");
	return el("div", { class: "store-facet" }, [
		el("p", { class: "store-facet__title" }, ["Category"]),
		el("ul", { class: "store-facet__list" }, [
			el("li", {}, [
				el(
					"a",
					{
						class: `store-facet__item${selected ? "" : " store-facet__item--active"}`,
						href: hrefWith(params, { category: null }, storeHref),
					},
					["All products"],
				),
			]),
			...categories.map((c) => {
				const active = selected === c.id;
				return el("li", {}, [
					el(
						"a",
						{
							class: `store-facet__item store-facet__item--row${active ? " store-facet__item--active" : ""}`,
							href: hrefWith(params, { category: active ? null : c.id }, storeHref),
						},
						[el("span", {}, [c.name]), el("span", { class: "store-facet__count" }, [String(c.count)])],
					),
				]);
			}),
		]),
	]);
}
