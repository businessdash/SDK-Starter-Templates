// [bd-file:blog]
import { el } from "/bd.js";
import { formatPostDate, readingMinutes } from "/shop/blog-elements.js";

/**
 * A post in the blog's list: cover, Pinned, date and reading time, title,
 * excerpt and author; `lead` draws it large. Returns the list item.
 */
export function postCard(post, { lead = false, blogHref = "/blog" } = {}) {
	return el("li", { class: `bd-card post-card${lead ? " post-card--lead" : ""}` }, [
		el("a", { class: "post-card__link", href: `${blogHref}/${encodeURIComponent(post.slug)}` }, [
			post.imageUrl
				? el("img", { alt: "", class: "post-card__img", loading: "lazy", referrerpolicy: "no-referrer", src: post.imageUrl })
				: null,
			el("div", { class: "post-card__body" }, [
				el("p", { class: "post-card__meta" }, [
					post.isPinned ? el("span", { class: "bd-badge" }, ["Pinned"]) : null,
					el("span", {}, [formatPostDate(post.publishedAt)]),
					el("span", {}, [`· ${readingMinutes(post.content || post.excerpt || "")} min read`]),
				]),
				el("h2", {}, [post.title]),
				post.excerpt ? el("p", { class: "post-card__excerpt" }, [post.excerpt]) : null,
				post.authorName ? el("p", { class: "post-card__author" }, [post.authorName]) : null,
			]),
		]),
	]);
}
