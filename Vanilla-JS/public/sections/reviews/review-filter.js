import { el } from "/bd.js";
import { sourceLabel } from "/shop/reviews-elements.js";

/**
 * All, Google, Yelp…: a link per platform the reviews come from
 * (?source=). Nothing shows with one platform.
 */
export function reviewFilter(sources, source, { reviewsHref = "/reviews" } = {}) {
	if (sources.length <= 1) return null;
	const chip = (href, label, current) =>
		el("li", {}, [el("a", { href, "aria-current": current ? "true" : "false" }, [label])]);
	return el("nav", { "aria-label": "Platform" }, [
		el("ul", { class: "reviews-filter" }, [
			chip(reviewsHref, "All", !source),
			...sources.map((s) => chip(`${reviewsHref}?source=${s}`, sourceLabel(s), source === s)),
		]),
	]);
}
