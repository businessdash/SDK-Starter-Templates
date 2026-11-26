import { el } from "/bd.js";
import { reviewStars } from "/shop/reviews-elements.js";

/**
 * The business's rating: the average, its stars, how many reviews, a bar
 * per star, and writing a review. `<bd-review-writer>`
 * (/shop/reviews-elements.js) posts a written review to `writeUrl`; signed
 * out, it's a link to sign in. `summary` is the page's summary
 * (summarizeReviews).
 */
export function ratingSummary(
	summary,
	signedIn,
	{ writeUrl = "/api/bd/reviews/write", signInHref = "/my-account?next=%2Freviews" } = {},
) {
	const average = summary.average == null ? null : summary.average.toFixed(1);
	const writer = el("bd-review-writer", {
		"data-write-url": writeUrl,
		"data-sign-in-href": signInHref,
	});
	writer.data = { signedIn };
	return el("section", { class: "reviews-summary", "aria-label": average ? "Rating" : "Write a review" }, [
		average &&
			el("div", { class: "reviews-summary__score" }, [
				el("span", { class: "reviews-summary__average" }, [average]),
				el("span", { class: "review-stars", role: "img", "aria-label": `${average} out of 5` }, [
					reviewStars(summary.average),
				]),
				el("span", { class: "reviews-summary__count" }, [
					`${summary.total} ${summary.total === 1 ? "review" : "reviews"}`,
				]),
			]),
		average &&
			el(
				"ul",
				{ class: "reviews-bars" },
				summary.histogram.map((row) =>
					el("li", { "aria-label": `${row.stars} ${row.stars === 1 ? "star" : "stars"}: ${row.count}` }, [
						el("span", {}, [`${row.stars} ★`]),
						el("span", { class: "reviews-bars__track" }, [
							el("span", { class: "reviews-bars__fill", style: `width: ${Math.round(row.share * 100)}%` }),
						]),
						el("span", {}, [String(row.count)]),
					]),
				),
			),
		el("div", { class: "reviews-summary__write" }, [writer]),
	]);
}
