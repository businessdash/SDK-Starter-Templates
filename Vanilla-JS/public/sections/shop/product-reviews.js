// [bd-file:store]
import { el } from "/bd.js";
import { starRating } from "/shop/shop-elements.js";
import { reviewDate } from "/shop/shop.js";

/** The product's reviews: the average, each review, and Show more reviews. */
export function productReviews(reviews, { moreHref = null } = {}) {
	const any = reviews && reviews.items.length > 0;
	return el("section", { class: "product-section", id: "reviews" }, [
		el("h2", { class: "product-section__title" }, ["Reviews"]),
		...(any
			? [
					el("p", { class: "reviews__summary" }, [
						starRating(reviews.avgRating),
						el("strong", {}, [`${reviews.avgRating.toFixed(1)} out of 5`]),
						el("span", {}, [`from ${reviews.totalCount} reviews`]),
					]),
					el(
						"div",
						{ class: "review-list" },
						reviews.items.map((review) =>
							el("article", { class: "review" }, [
								el("div", { class: "review__head" }, [
									starRating(review.rating),
									el("span", { class: "review__name" }, [review.reviewerName || "Verified buyer"]),
									el("span", { class: "review__date" }, [reviewDate(review.createdAt)]),
								]),
								review.title ? el("p", { class: "review__title" }, [review.title]) : null,
								review.content || review.body
									? el("p", { class: "review__body" }, [review.content || review.body])
									: null,
							]),
						),
					),
					moreHref ? el("a", { class: "bd-btn bd-btn--ghost reviews__more", href: moreHref }, ["Show more reviews"]) : null,
				]
			: [el("p", { class: "reviews__none" }, ["No reviews yet."])]),
	]);
}
