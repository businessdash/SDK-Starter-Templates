// [bd-file:store]
import type { StorefrontProductReviewsResponse } from "@businessdash/sdk/contracts";
import { Show } from "solid-js";

import type { ProductView } from "../../../lib/shop/shop";
import { ShopStars } from "../ShopStars";

/** The category, the name, and the stars linking to the reviews. */
export function ProductTitle(props: {
	product: ProductView;
	reviews: StorefrontProductReviewsResponse | null;
}) {
	return (
		<div>
			<Show when={props.product.categoryName}>
				<p class="product-detail__eyebrow">{props.product.categoryName}</p>
			</Show>
			<h1>{props.product.name}</h1>
			<Show when={props.reviews && props.reviews.totalCount > 0 && props.reviews}>
				{(reviews) => (
					<a class="product-detail__rating" href="#reviews">
						<ShopStars rating={reviews().avgRating} />
						<span>{`${reviews().avgRating.toFixed(1)} · ${reviews().totalCount} reviews`}</span>
					</a>
				)}
			</Show>
		</div>
	);
}
