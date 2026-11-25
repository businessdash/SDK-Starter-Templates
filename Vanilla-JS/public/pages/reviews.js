/**
 * /reviews — the business's reviews: the rating with a bar per star, a
 * platform filter (?source=), each review with its photos, Verified and a
 * link to it on Google or Yelp, "Show more" (?shown=), and writing one. The
 * filter and "Show more" are plain links. The server gathers the page
 * (GET /api/bd/reviews/page); <bd-review-writer> posts a written review to
 * POST /api/bd/reviews/write, and signed out it's a link to sign in. The
 * rules are lib/shop/reviews.ts, the same in every BD starter. The page is
 * laid out from the reviews' parts (/sections/reviews/): the rating
 * summary, the platform filter and a card per review.
 */
import { sourceLabel } from "/shop/reviews-elements.js";
import { el } from "/bd.js";
import { ratingSummary } from "/sections/reviews/rating-summary.js";
import { reviewCard } from "/sections/reviews/review-card.js";
import { reviewFilter } from "/sections/reviews/review-filter.js";
import { errBox } from "./_ui.js";

export default async function render(root) {
	const here = new URLSearchParams(location.search);
	const query = new URLSearchParams();
	for (const key of ["source", "shown"]) {
		const value = here.get(key);
		if (value) query.set(key, value);
	}
	const search = query.toString();
	let data;
	try {
		const res = await fetch(`/api/bd/reviews/page${search ? `?${search}` : ""}`);
		if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
		data = await res.json();
	} catch (err) {
		root.replaceChildren(errBox(err));
		return;
	}
	root.replaceChildren(...reviewsView(data));
	// "Show more" leads to the first new review, there now that it's drawn.
	const id = decodeURIComponent(location.hash.slice(1));
	if (id) document.getElementById(id)?.scrollIntoView();
}

function reviewsView(data) {
	const lead = el("div", { class: "bd-section__lead" }, [
		el("span", { class: "bd-section__eyebrow" }, ["Reviews"]),
		el("h1", { class: "bd-section__title" }, ["What customers say"]),
	]);
	if (!data.configured) {
		return [
			lead,
			el("div", { class: "bd-empty" }, [
				"Reviews aren't connected yet. Set BD_API_KEY and BD_SITE_ID, and your rating and reviews appear here.",
			]),
		];
	}
	const nodes = [lead, ratingSummary(data.summary, data.signedIn)];
	if (data.sources.length > 1) nodes.push(reviewFilter(data.sources, data.source));
	if (data.reviews.length === 0) {
		nodes.push(
			el("p", { class: "reviews-empty" }, [
				data.source
					? `No ${sourceLabel(data.source)} reviews yet.`
					: "No reviews yet. Connect Google or Yelp in BusinessDash, or add reviews in the dashboard, and they'll appear here.",
			]),
		);
		return nodes;
	}
	nodes.push(el("ul", { class: "review-wall" }, data.reviews.map(reviewCard)));
	if (data.moreHref) {
		nodes.push(
			el("p", { class: "reviews-more" }, [
				el("a", { class: "bd-btn bd-btn--ghost", href: data.moreHref }, ["Show more reviews"]),
			]),
		);
	}
	return nodes;
}
