// [bd-file:store]
import { html, type Raw } from "../../html";
import { hrefWith } from "./store-filters";

/** All products, then each category with how many products it has, as links (?category). */
export function categoryFilter(
	params: URLSearchParams,
	categories: { id: string; name: string; count: number }[],
	{ storeHref = "/store" } = {},
): Raw {
	if (categories.length === 0) return html``;
	const selected = params.get("category");
	return html`<div class="store-facet">
		<p class="store-facet__title">Category</p>
		<ul class="store-facet__list">
			<li><a class="store-facet__item${selected ? "" : " store-facet__item--active"}" href="${hrefWith(params, { category: null }, storeHref)}">All products</a></li>
			${categories.map((c) => {
				const active = selected === c.id;
				return html`<li><a class="store-facet__item store-facet__item--row${active ? " store-facet__item--active" : ""}" href="${hrefWith(params, { category: active ? null : c.id }, storeHref)}"><span>${c.name}</span><span class="store-facet__count">${String(c.count)}</span></a></li>`;
			})}
		</ul>
	</div>`;
}
