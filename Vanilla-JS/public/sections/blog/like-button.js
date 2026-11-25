// [bd-file:blog]
import { el } from "/bd.js";

/**
 * ♥ Like and the count. Likes are for signed-in customers: `<bd-post-like>`
 * (/shop/blog-elements.js) posts to `likeUrl`; signed out, it leads to
 * sign-in and back.
 */
export function likeButton({ likes, signedIn, likeUrl, signInHref }) {
	return el("bd-post-like", { "data-like-url": likeUrl, "data-sign-in-href": signInHref }, [
		el("script", { type: "application/json" }, [JSON.stringify({ likes, signedIn })]),
	]);
}
