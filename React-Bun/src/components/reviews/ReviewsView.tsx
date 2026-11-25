import type { ReactNode } from "react";

import { BdLink } from "../bd-link";
import { RatingSummary } from "./RatingSummary";
import { ReviewCard } from "./ReviewCard";
import { ReviewFilter } from "./ReviewFilter";
import { sourceLabel } from "./reviews";
import type { ReviewsPageData } from "./reviews-page";

/**
 * The business's reviews: the rating with a bar per star, a platform filter
 * (`?source=`), each review with its photos, Verified and a link to it on
 * Google or Yelp, and "Show more" (`?shown=`). `writer` is the
 * <ReviewWriter> wired to this framework's way of sending.
 *
 * It's built from <RatingSummary>, <ReviewFilter> and <ReviewCard>. Use
 * this whole, or lay them out your own way on your own reviews page.
 */
export function ReviewsView({
	data,
	writer,
}: {
	data: ReviewsPageData;
	writer: ReactNode;
}) {
	return (
		<>
			<div className="bd-section__lead">
				<span className="bd-section__eyebrow">Reviews</span>
				<h1 className="bd-section__title">What customers say</h1>
			</div>

			{!data.configured ? (
				<div className="bd-empty">
					Reviews aren&apos;t connected yet. Set BD_API_KEY and BD_SITE_ID, and
					your rating and reviews appear here.
				</div>
			) : (
				<>
					<RatingSummary summary={data.summary} writer={writer} />
					<ReviewFilter source={data.source} sources={data.sources} />

					{data.reviews.length === 0 ? (
						<p className="reviews-empty">
							{data.source
								? `No ${sourceLabel(data.source)} reviews yet.`
								: "No reviews yet. Connect Google or Yelp in BusinessDash, or add reviews in the dashboard, and they'll appear here."}
						</p>
					) : (
						<>
							<ul className="review-wall">
								{data.reviews.map((review, i) => (
									<ReviewCard index={i} key={review.id} review={review} />
								))}
							</ul>
							{data.moreHref ? (
								<p className="reviews-more">
									<BdLink className="bd-btn bd-btn--ghost" href={data.moreHref}>
										Show more reviews
									</BdLink>
								</p>
							) : null}
						</>
					)}
				</>
			)}
		</>
	);
}
