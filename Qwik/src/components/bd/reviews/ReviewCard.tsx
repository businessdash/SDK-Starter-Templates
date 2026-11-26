import {
	formatReviewDate,
	platformName,
	reviewerInitial,
	reviewerName,
	reviewLink,
	reviewStars,
	safeImage,
	type WallReview,
} from "../../../lib/shop/reviews";

/**
 * One review: the reviewer's photo or initial, name, stars and date, the
 * text, their photos, and the platform with Verified and "Read on Google".
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
		<li class="review-card" id={`review-${index}`}>
			<div class="review-card__head">
				{avatar ? (
					<img
						class="review-card__avatar"
						src={avatar}
						alt=""
						loading="lazy"
						width={40}
						height={40}
					/>
				) : (
					<span class="review-card__avatar" aria-hidden="true">
						{reviewerInitial(review)}
					</span>
				)}
				<div>
					<p class="review-card__name">{reviewerName(review)}</p>
					<p class="review-card__meta">
						<span
							class="review-stars"
							role="img"
							aria-label={`${review.rating} out of 5`}
						>
							{reviewStars(review.rating)}
						</span>{" "}
						· {formatReviewDate(review.timeCreated)}
					</p>
				</div>
			</div>
			<p class="review-card__text">{review.text}</p>
			{photos.length > 0 ? (
				<ul class="review-card__photos" aria-label="Photos from the reviewer">
					{photos.map((photo) => (
						<li key={photo}>
							<img src={photo} alt="" loading="lazy" width={88} height={88} />
						</li>
					))}
				</ul>
			) : null}
			{platform || review.verified ? (
				<p class="review-card__foot">
					{platform ? (
						<span class="review-card__platform">{platform}</span>
					) : null}
					{review.verified ? (
						<span class="review-card__verified">✓ Verified</span>
					) : null}
					{link && platform ? (
						<a
							class="review-card__link"
							href={link}
							target="_blank"
							rel="noopener noreferrer"
						>
							Read on {platform}
						</a>
					) : null}
				</p>
			) : null}
		</li>
	);
}
