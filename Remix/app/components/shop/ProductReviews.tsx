// [bd-file:store]
import type { StorefrontProductReviewsResponse } from "@businessdash/sdk/contracts";
import { BdLink } from "../bd-link";
import { StarRating } from "./StarRating";

/** The product's reviews: the average, each review, and "Show more reviews". */
export function ProductReviews({
	reviews,
	moreHref,
}: {
	reviews: StorefrontProductReviewsResponse | null;
	/** The link that shows more reviews, or null when all are shown. */
	moreHref: string | null;
}) {
	return (
		<section className="product-section" id="reviews">
			<h2 className="product-section__title">Reviews</h2>
			{reviews && reviews.items.length > 0 ? (
				<>
					<p className="reviews__summary">
						<StarRating rating={reviews.avgRating} />
						<strong>{reviews.avgRating.toFixed(1)} out of 5</strong>
						<span>from {reviews.totalCount} reviews</span>
					</p>
					<div className="review-list">
						{reviews.items.map((review) => (
							<article className="review" key={review.id}>
								<div className="review__head">
									<StarRating rating={review.rating} />
									<span className="review__name">
										{review.reviewerName || "Verified buyer"}
									</span>
									<span className="review__date">
										{reviewDate(review.createdAt)}
									</span>
								</div>
								{review.title && (
									<p className="review__title">{review.title}</p>
								)}
								{(review.content || review.body) && (
									<p className="review__body">
										{review.content || review.body}
									</p>
								)}
							</article>
						))}
					</div>
					{moreHref && (
						<BdLink
							className="bd-btn bd-btn--ghost reviews__more"
							href={moreHref}
						>
							Show more reviews
						</BdLink>
					)}
				</>
			) : (
				<p className="reviews__none">No reviews yet.</p>
			)}
		</section>
	);
}

function reviewDate(iso: string | null | undefined): string {
	const date = iso ? new Date(iso) : null;
	return date && !Number.isNaN(date.getTime())
		? date.toLocaleDateString(undefined, {
				year: "numeric",
				month: "short",
				day: "numeric",
			})
		: "";
}
