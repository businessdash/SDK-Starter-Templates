// [bd-file:blog]
import { el } from "/bd.js";

/** The post's tags, each linking to the posts with it. */
export function postTags(tags, { blogHref = "/blog" } = {}) {
	if (tags.length === 0) return null;
	return el(
		"ul",
		{ class: "post__tags" },
		tags.map((tag) => el("li", {}, [el("a", { href: `${blogHref}?tag=${encodeURIComponent(tag)}` }, [`#${tag}`])])),
	);
}
