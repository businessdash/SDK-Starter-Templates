// [bd-file:store]
import type { StorefrontProductReviewsResponse } from "@businessdash/sdk/contracts";
import { html, type Raw } from "../../html";
import type { ProductView } from "../../shop/shop";
import { starRating } from "./star-rating";

/** The category, the name, and the stars linking to the reviews. */
export function productTitle(product: ProductView, reviews: StorefrontProductReviewsResponse | null): Raw {
	return html`<div>
		${product.categoryName ? html`<p class="product-detail__eyebrow">${product.categoryName}</p>` : ""}
		<h1>${product.name}</h1>
		${
			reviews && reviews.totalCount > 0
				? html`<a class="product-detail__rating" href="#reviews">${starRating(reviews.avgRating)}<span>${`${reviews.avgRating.toFixed(1)} · ${reviews.totalCount} reviews`}</span></a>`
				: ""
		}
	</div>`;
}
