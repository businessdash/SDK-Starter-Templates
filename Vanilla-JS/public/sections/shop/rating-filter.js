// [bd-file:store]
import { el } from "/bd.js";
import { starRating } from "/shop/shop-elements.js";
import { hrefWith } from "./store-filters.js";

/** 4, 3 or 2 stars & up, as links (?rating). */
export function ratingFilter(params, { storeHref = "/store" } = {}) {
	const raw = Number.parseInt(params.get("rating") ?? "", 10);
	const selected = raw >= 1 && raw <= 5 ? raw : 0;
	return el("div", { class: "store-facet" }, [
		el("p", { class: "store-facet__title" }, ["Rating"]),
		el(
			"ul",
			{ class: "store-facet__list" },
			[4, 3, 2].map((r) => {
				const active = selected === r;
				return el("li", {}, [
					el(
						"a",
						{
							class: `store-facet__item store-facet__rating${active ? " store-facet__item--active" : ""}`,
							href: hrefWith(params, { rating: active ? null : String(r) }, storeHref),
						},
						[starRating(r), el("span", { class: "store-facet__count" }, ["& up"])],
					),
				]);
			}),
		),
	]);
}
