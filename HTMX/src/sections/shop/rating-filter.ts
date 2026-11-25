// [bd-file:store]
import { html, type Raw } from "../../html";
import { starRating } from "./star-rating";
import { hrefWith, ratingOf } from "./store-filters";

/** 4, 3 or 2 stars & up, as links (?rating). */
export function ratingFilter(params: URLSearchParams, { storeHref = "/store" } = {}): Raw {
	const selected = ratingOf(params);
	return html`<div class="store-facet">
		<p class="store-facet__title">Rating</p>
		<ul class="store-facet__list">
			${[4, 3, 2].map((r) => {
				const active = selected === r;
				return html`<li><a class="store-facet__item store-facet__rating${active ? " store-facet__item--active" : ""}" href="${hrefWith(params, { rating: active ? null : String(r) }, storeHref)}">${starRating(r)}<span class="store-facet__count">&amp; up</span></a></li>`;
			})}
		</ul>
	</div>`;
}
