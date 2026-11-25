import {
	formatReviewDate,
	platformName,
	reviewerInitial,
	reviewerName,
	reviewLink,
	reviewStars,
	safeImage,
	type WallReview,
} from "./reviews";

/**
 * One review: the reviewer and their photo, the stars and date, the text,
 * their photos, the platform, Verified, and a link to it on that platform.
 * `index` gives it an id (review-0, review-1…) for linking to it.
 */
export function ReviewCard({
	review,
	index,
}: {
	review: WallReview;
	index: number;
}) {
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
