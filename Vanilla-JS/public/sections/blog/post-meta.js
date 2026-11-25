// [bd-file:blog]
import { el } from "/bd.js";
import { formatPostDate } from "/shop/blog-elements.js";

/** The author (photo and name), the date and the reading time. */
export function postMeta(post, minutes) {
	return el("p", { class: "post__meta" }, [
		post.authorAvatarUrl ? el("img", { alt: "", referrerpolicy: "no-referrer", src: post.authorAvatarUrl }) : null,
		post.authorName ? el("span", {}, [post.authorName]) : null,
		el("span", {}, [formatPostDate(post.publishedAt)]),
		el("span", {}, [`· ${minutes} min read`]),
	]);
}
