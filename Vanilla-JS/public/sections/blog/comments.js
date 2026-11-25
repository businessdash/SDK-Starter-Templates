// [bd-file:blog]
import { el } from "/bd.js";

/**
 * The comments and the box to add one. Commenting is for signed-in
 * customers: `<bd-post-comments>` (/shop/blog-elements.js) posts to
 * `commentUrl`; signed out, it leads to sign-in and back.
 */
export function comments({ comments, signedIn, commentUrl, signInHref }) {
	return el("bd-post-comments", { "data-comment-url": commentUrl, "data-sign-in-href": signInHref }, [
		el("script", { type: "application/json" }, [JSON.stringify({ comments, signedIn })]),
	]);
}
