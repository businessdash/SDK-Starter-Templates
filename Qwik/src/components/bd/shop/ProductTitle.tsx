// [bd-file:store]
import type { StorefrontProductReviewsResponse } from "@businessdash/sdk/contracts";

import type { ProductView } from "../../../lib/shop/shop";
import { ShopStars } from "../ShopStars";

/** The category, the name, and the stars linking to the reviews. */
export function ProductTitle({
	product,
	reviews,
}: {
	product: ProductView;
	reviews: StorefrontProductReviewsResponse | null;
}) {
	return (
		<div>
			{product.categoryName ? <p class="product-detail__eyebrow">{product.categoryName}</p> : null}
			<h1>{product.name}</h1>
			{reviews && reviews.totalCount > 0 ? (
				<a class="product-detail__rating" href="#reviews">
					<ShopStars rating={reviews.avgRating} />
					<span>{`${reviews.avgRating.toFixed(1)} · ${reviews.totalCount} reviews`}</span>
				</a>
			) : null}
		</div>
	);
}
