import { For, Show } from "solid-js";

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
 * text, any photos, the platform, Verified, and a link to it there.
 * `index` gives it an id (review-3), so "Show more" can land on it.
 */
export function ReviewCard(props: { review: WallReview; index: number }) {
	const avatar = () => safeImage(props.review.reviewerImageUrl);
	const platform = () => platformName(props.review.source);
	const link = () => reviewLink(props.review);
	const photos = () =>
		(props.review.photos ?? [])
			.map(safeImage)
			.filter((p): p is string => p !== null);

	return (
		<li class="review-card" id={`review-${props.index}`}>
			<div class="review-card__head">
				<Show
					when={avatar()}
					fallback={
						<span class="review-card__avatar" aria-hidden="true">
							{reviewerInitial(props.review)}
						</span>
					}
				>
					<img
						class="review-card__avatar"
						src={avatar() ?? ""}
						alt=""
						loading="lazy"
					/>
				</Show>
				<div>
					<p class="review-card__name">{reviewerName(props.review)}</p>
					<p class="review-card__meta">
						<span
							class="review-stars"
							role="img"
							aria-label={`${props.review.rating} out of 5`}
						>
							{reviewStars(props.review.rating)}
						</span>{" "}
						· {formatReviewDate(props.review.timeCreated)}
					</p>
				</div>
			</div>
			<p class="review-card__text">{props.review.text}</p>
			<Show when={photos().length > 0}>
				<ul class="review-card__photos" aria-label="Photos from the reviewer">
					<For each={photos()}>
						{(photo) => (
							<li>
								<img src={photo} alt="" loading="lazy" />
							</li>
						)}
					</For>
				</ul>
			</Show>
			<Show when={platform() || props.review.verified}>
				<p class="review-card__foot">
					<Show when={platform()}>
						<span class="review-card__platform">{platform()}</span>
					</Show>
					<Show when={props.review.verified}>
						<span class="review-card__verified">✓ Verified</span>
					</Show>
					<Show when={link() && platform()}>
						<a
							class="review-card__link"
							href={link() ?? ""}
							target="_blank"
							rel="noopener noreferrer"
						>
							Read on {platform()}
						</a>
					</Show>
				</p>
			</Show>
		</li>
	);
}
