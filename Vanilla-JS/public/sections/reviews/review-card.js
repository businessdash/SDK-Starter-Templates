import { el } from "/bd.js";
import {
	formatReviewDate,
	platformName,
	reviewerInitial,
	reviewerName,
	reviewLink,
	reviewStars,
	safeImage,
} from "/shop/reviews-elements.js";

/**
 * One review, as a list item (id review-<index>, so "Show more" can lead to
 * it): the reviewer's photo (or initial) and name, stars and date, the
 * text, their photos, the platform, Verified, and a link to it on Google or
 * Yelp.
 */
export function reviewCard(review, index) {
	const avatar = safeImage(review.reviewerImageUrl);
	const platform = platformName(review.source);
	const link = reviewLink(review);
	const photos = (review.photos ?? []).map(safeImage).filter(Boolean);
	return el("li", { class: "review-card", id: `review-${index}` }, [
		el("div", { class: "review-card__head" }, [
			avatar
				? el("img", { class: "review-card__avatar", src: avatar, alt: "", loading: "lazy" })
				: el("span", { class: "review-card__avatar", "aria-hidden": "true" }, [reviewerInitial(review)]),
			el("div", {}, [
				el("p", { class: "review-card__name" }, [reviewerName(review)]),
				el("p", { class: "review-card__meta" }, [
					el("span", { class: "review-stars", role: "img", "aria-label": `${review.rating} out of 5` }, [
						reviewStars(review.rating),
					]),
					` · ${formatReviewDate(review.timeCreated)}`,
				]),
			]),
		]),
		el("p", { class: "review-card__text" }, [review.text ?? ""]),
		photos.length > 0 &&
			el(
				"ul",
				{ class: "review-card__photos", "aria-label": "Photos from the reviewer" },
				photos.map((photo) => el("li", {}, [el("img", { src: photo, alt: "", loading: "lazy" })])),
			),
		(platform || review.verified) &&
			el("p", { class: "review-card__foot" }, [
				platform && el("span", { class: "review-card__platform" }, [platform]),
				review.verified && el("span", { class: "review-card__verified" }, ["✓ Verified"]),
				link &&
					platform &&
					el("a", { class: "review-card__link", href: link, target: "_blank", rel: "noopener noreferrer" }, [
						`Read on ${platform}`,
					]),
			]),
	]);
}
