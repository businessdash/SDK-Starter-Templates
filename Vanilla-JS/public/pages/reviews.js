/**
 * /reviews — the business's reviews: the rating with a bar per star, a
 * platform filter (?source=), each review with its photos, Verified and a
 * link to it on Google or Yelp, "Show more" (?shown=), and writing one. The
 * filter and "Show more" are plain links. The server gathers the page
 * (GET /api/bd/reviews/page); <bd-review-writer> posts a written review to
 * POST /api/bd/reviews/write, and signed out it's a link to sign in. The
 * rules are lib/shop/reviews.ts, the same in every BD starter.
 */
import {
	formatReviewDate,
	platformName,
	reviewerInitial,
	reviewerName,
	reviewLink,
	reviewStars,
	safeImage,
	sourceLabel,
} from "/shop/reviews-elements.js";
import { el } from "/bd.js";
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
	const nodes = [lead, summary(data)];
	if (data.sources.length > 1) nodes.push(filter(data));
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

function summary(data) {
	const { summary } = data;
	const average = summary.average == null ? null : summary.average.toFixed(1);
	const writer = el("bd-review-writer", {
		"data-write-url": "/api/bd/reviews/write",
		"data-sign-in-href": "/my-account?next=%2Freviews",
	});
	writer.data = { signedIn: data.signedIn };
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
					el("li", { "aria-label": `${row.stars} stars: ${row.count}` }, [
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

function filter(data) {
	const chip = (href, label, current) =>
		el("li", {}, [el("a", { href, "aria-current": current ? "true" : "false" }, [label])]);
	return el("nav", { "aria-label": "Platform" }, [
		el("ul", { class: "reviews-filter" }, [
			chip("/reviews", "All", !data.source),
			...data.sources.map((source) =>
				chip(`/reviews?source=${source}`, sourceLabel(source), data.source === source),
			),
		]),
	]);
}

function reviewCard(review, index) {
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
