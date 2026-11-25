// [bd-file:blog]
/**
 * /blog/:slug — one post. The server rebuilds its HTML from an allowlist
 * (`safePostHtml` in lib/shop/blog.ts) and only that reaches the page.
 * Likes and comments are for signed-in customers: `<bd-post-like>` and
 * `<bd-post-comments>` from /shop/blog-elements.js post to
 * /api/bd/blog/post/:slug/{like,comment}; signed out, they lead to sign-in
 * and back here.
 */
import { formatPostDate } from "/shop/blog-elements.js";
import { bd, el } from "/bd.js";
import { errBox } from "./_ui.js";

/** Web, mail and same-site links only, so a post's button can't run script. */
function safeHref(href) {
	return typeof href === "string" && /^(https?:|mailto:|\/|#)/i.test(href) ? href : null;
}

export default async function render(root) {
	const slug = decodeURIComponent(location.pathname.split("/").pop() ?? "");
	let data;
	try {
		data = await bd.blog.getPost(slug);
	} catch (err) {
		root.replaceChildren(errBox(err));
		return;
	}
	if (!data) {
		root.replaceChildren(
			el("div", { class: "bd-empty" }, ["That post isn't available. ", el("a", { href: "/blog" }, ["See all posts"])]),
		);
		return;
	}
	const { post } = data;
	document.title = `${post.title} — Blog`;
	const here = `/blog/${encodeURIComponent(slug)}`;
	const signInHref = `/my-account?next=${encodeURIComponent(here)}`;
	const api = `/api/bd/blog/post/${encodeURIComponent(slug)}`;
	const ctaHref = safeHref(post.ctaHref);
	const json = (value) => el("script", { type: "application/json" }, [JSON.stringify(value)]);

	const body = el("div", { class: "post__body" }, []);
	// Already rebuilt from an allowlist on the server (see lib/shop/blog.ts).
	body.innerHTML = data.html;

	root.replaceChildren(
		el("article", { class: "post" }, [
			el("a", { class: "post__back", href: "/blog" }, ["← All posts"]),
			el("header", { class: "post__head" }, [
				el("h1", {}, [post.title]),
				el("p", { class: "post__meta" }, [
					post.authorAvatarUrl ? el("img", { alt: "", referrerpolicy: "no-referrer", src: post.authorAvatarUrl }) : null,
					post.authorName ? el("span", {}, [post.authorName]) : null,
					el("span", {}, [formatPostDate(post.publishedAt)]),
					el("span", {}, [`· ${data.minutes} min read`]),
				]),
			]),
			post.imageUrl ? el("img", { alt: "", class: "post__cover", referrerpolicy: "no-referrer", src: post.imageUrl }) : null,
			data.paywalled
				? el("div", { class: "bd-empty" }, [
						"This post is for members.",
						el("p", {}, [el("a", { class: "bd-btn", href: signInHref }, ["Sign in to read it"])]),
					])
				: body,
			ctaHref && post.ctaLabel
				? el("aside", { class: "bd-card post__cta" }, [
						post.ctaDescription ? el("p", {}, [post.ctaDescription]) : null,
						el("a", { class: "bd-btn", href: ctaHref }, [post.ctaLabel]),
					])
				: null,
			post.tags.length > 0
				? el(
						"ul",
						{ class: "post__tags" },
						post.tags.map((tag) => el("li", {}, [el("a", { href: `/blog?tag=${encodeURIComponent(tag)}` }, [`#${tag}`])])),
					)
				: null,
			el("bd-post-like", { "data-like-url": `${api}/like`, "data-sign-in-href": signInHref }, [
				json({ likes: data.likes, signedIn: data.signedIn }),
			]),
		]),
		el("bd-post-comments", { "data-comment-url": `${api}/comment`, "data-sign-in-href": signInHref }, [
			json({ comments: data.comments, signedIn: data.signedIn }),
		]),
	);
}
