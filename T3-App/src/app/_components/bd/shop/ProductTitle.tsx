// [bd-file:store]
import type { StorefrontProductReviewsResponse } from "@businessdash/sdk/contracts";
import { StarRating } from "./StarRating";
import type { ProductView } from "./shop";

/** The product's category, its name, and its rating (a link to the reviews). */
export function ProductTitle({
	product,
	reviews,
}: {
	product: ProductView;
	reviews: StorefrontProductReviewsResponse | null;
}) {
	return (
		<div>
			{product.categoryName && (
				<p className="product-detail__eyebrow">{product.categoryName}</p>
			)}
			<h1>{product.name}</h1>
			{reviews && reviews.totalCount > 0 && (
				<a className="product-detail__rating" href="#reviews">
					<StarRating rating={reviews.avgRating} />
					<span>
						{reviews.avgRating.toFixed(1)} · {reviews.totalCount} reviews
					</span>
				</a>
			)}
		</div>
	);
}
