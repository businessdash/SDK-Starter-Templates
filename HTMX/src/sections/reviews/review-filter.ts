import { html, type Raw } from "../../html";
import { type ReviewSource, sourceLabel } from "../../shop/reviews";

/**
 * All, Google, Yelp…: a link per platform the reviews come from
 * (?source=). Nothing shows with one platform.
 */
export function reviewFilter(
	sources: ReviewSource[],
	active: ReviewSource | null | undefined,
	{ reviewsHref = "/reviews" } = {},
): Raw {
	if (sources.length <= 1) return html``;
	return html`<nav aria-label="Platform">
		<ul class="reviews-filter">
			<li><a href="${reviewsHref}" aria-current="${active ? "false" : "true"}">All</a></li>
			${sources.map(
				(s) => html`<li><a href="${`${reviewsHref}?source=${s}`}" aria-current="${active === s ? "true" : "false"}">${sourceLabel(s)}</a></li>`,
			)}
		</ul>
	</nav>`;
}
