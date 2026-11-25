import type { ReactNode } from "react";

import { BdLink } from "../bd-link";
import {
	formatReviewDate,
	platformName,
	reviewerInitial,
	reviewerName,
	reviewLink,
	reviewStars,
	safeImage,
	sourceLabel,
	type WallReview,
} from "./reviews";
import type { ReviewsPageData } from "./reviews-page";

/**
 * The business's reviews: the rating with a bar per star, a platform filter
 * (`?source=`), each review with its photos, Verified and a link to it on
 * Google or Yelp, and "Show more" (`?shown=`). `writer` is the
 * <ReviewWriter> wired to this framework's way of sending.
 */
export function ReviewsView({
	data,
	writer,
}: {
	data: ReviewsPageData;
	writer: ReactNode;
}) {
	const { summary } = data;
	const average = summary.average?.toFixed(1) ?? null;
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
					<section
						aria-label={average ? "Rating" : "Write a review"}
						className="reviews-summary"
					>
						{average ? (
							<>
								<div className="reviews-summary__score">
									<span className="reviews-summary__average">{average}</span>
									<span
										aria-label={`${average} out of 5`}
										className="review-stars"
										role="img"
									>
										{reviewStars(summary.average ?? 0)}
									</span>
									<span className="reviews-summary__count">
										{summary.total} {summary.total === 1 ? "review" : "reviews"}
									</span>
								</div>
								<ul className="reviews-bars">
									{summary.histogram.map((row) => (
										<li
											aria-label={`${row.stars} stars: ${row.count}`}
											key={row.stars}
										>
											<span>{row.stars} ★</span>
											<span className="reviews-bars__track">
												<span
													className="reviews-bars__fill"
													style={{ width: `${Math.round(row.share * 100)}%` }}
												/>
											</span>
											<span>{row.count}</span>
										</li>
									))}
								</ul>
							</>
						) : null}
						<div className="reviews-summary__write">{writer}</div>
					</section>

					{data.sources.length > 1 ? (
						<nav aria-label="Platform">
							<ul className="reviews-filter">
								<li>
									<BdLink
										aria-current={data.source ? "false" : "true"}
										href="/reviews"
									>
										All
									</BdLink>
								</li>
								{data.sources.map((source) => (
									<li key={source}>
										<BdLink
											aria-current={data.source === source ? "true" : "false"}
											href={`/reviews?source=${source}`}
										>
											{sourceLabel(source)}
										</BdLink>
									</li>
								))}
							</ul>
						</nav>
					) : null}

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

function ReviewCard({ review, index }: { review: WallReview; index: number }) {
	const avatar = safeImage(review.reviewerImageUrl);
	const platform = platformName(review.source);
	const link = reviewLink(review);
	const photos = (review.photos ?? [])
		.map(safeImage)
		.filter((p): p is string => p !== null);
	return (
		<li className="review-card" id={`review-${index}`}>
			<div className="review-card__head">
				{avatar ? (
					<img
						alt=""
						className="review-card__avatar"
						loading="lazy"
						src={avatar}
					/>
				) : (
					<span aria-hidden="true" className="review-card__avatar">
						{reviewerInitial(review)}
					</span>
				)}
				<div>
					<p className="review-card__name">{reviewerName(review)}</p>
					<p className="review-card__meta">
						<span
							aria-label={`${review.rating} out of 5`}
							className="review-stars"
							role="img"
						>
							{reviewStars(review.rating)}
						</span>{" "}
						· {formatReviewDate(review.timeCreated)}
					</p>
				</div>
			</div>
			<p className="review-card__text">{review.text}</p>
			{photos.length ? (
				<ul
					aria-label="Photos from the reviewer"
					className="review-card__photos"
				>
					{photos.map((photo) => (
						<li key={photo}>
							<img alt="" loading="lazy" src={photo} />
						</li>
					))}
				</ul>
			) : null}
			{platform || review.verified ? (
				<p className="review-card__foot">
					{platform ? (
						<span className="review-card__platform">{platform}</span>
					) : null}
					{review.verified ? (
						<span className="review-card__verified">✓ Verified</span>
					) : null}
					{link && platform ? (
						<a
							className="review-card__link"
							href={link}
							rel="noopener noreferrer"
							target="_blank"
						>
							Read on {platform}
						</a>
					) : null}
				</p>
			) : null}
		</li>
	);
}
