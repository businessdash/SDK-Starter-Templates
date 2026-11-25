// [bd-file:blog]
/**
 * /blog/:slug — one post. The server rebuilds its HTML from an allowlist
 * (`safePostHtml` in lib/shop/blog.ts) and only that reaches the page.
 * Likes and comments are for signed-in customers: `<bd-post-like>` and
 * `<bd-post-comments>` from /shop/blog-elements.js post to
 * /api/bd/blog/post/:slug/{like,comment}; signed out, they lead to sign-in
 * and back here. The page is laid out from the blog's parts
 * (/sections/blog/): meta, body (or members-only), call to action, tags,
 * like button and comments.
 */
import "/shop/blog-elements.js";
import { bd, el } from "/bd.js";
import { comments } from "/sections/blog/comments.js";
import { likeButton } from "/sections/blog/like-button.js";
import { membersOnly } from "/sections/blog/members-only.js";
import { postBody } from "/sections/blog/post-body.js";
import { postCta } from "/sections/blog/post-cta.js";
import { postMeta } from "/sections/blog/post-meta.js";
import { postTags } from "/sections/blog/post-tags.js";
import { errBox } from "./_ui.js";

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

	root.replaceChildren(
		el("article", { class: "post" }, [
			el("a", { class: "post__back", href: "/blog" }, ["← All posts"]),
			el("header", { class: "post__head" }, [
				el("h1", {}, [post.title]),
				postMeta(post, data.minutes),
			]),
			post.imageUrl ? el("img", { alt: "", class: "post__cover", referrerpolicy: "no-referrer", src: post.imageUrl }) : null,
			data.paywalled ? membersOnly(signInHref) : postBody(data.html),
			postCta(post),
			postTags(post.tags),
			likeButton({ likes: data.likes, signedIn: data.signedIn, likeUrl: `${api}/like`, signInHref }),
		]),
		comments({ comments: data.comments, signedIn: data.signedIn, commentUrl: `${api}/comment`, signInHref }),
	);
}
