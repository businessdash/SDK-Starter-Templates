// [bd-file:blog]
import { html, jsonScript, type Raw } from "../../html";

/**
 * The comments and the box to add one. Commenting is for signed-in
 * customers: `<bd-post-comments>` (src/shop/blog-elements.ts) posts to
 * `commentUrl`; signed out, it leads to sign-in and back.
 */
export function comments(opts: { comments: unknown[]; signedIn: boolean; commentUrl: string; signInHref: string }): Raw {
	return html`<bd-post-comments data-comment-url="${opts.commentUrl}" data-sign-in-href="${opts.signInHref}">
		${jsonScript({ comments: opts.comments, signedIn: opts.signedIn })}
	</bd-post-comments>`;
}
