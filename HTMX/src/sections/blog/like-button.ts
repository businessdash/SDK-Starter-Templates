// [bd-file:blog]
import { html, jsonScript, type Raw } from "../../html";

/**
 * ♥ Like and the count. Likes are for signed-in customers: `<bd-post-like>`
 * (src/shop/blog-elements.ts) posts to `likeUrl`; signed out, it leads to
 * sign-in and back.
 */
export function likeButton(opts: {
	likes: { liked: boolean; likesCount: number };
	signedIn: boolean;
	likeUrl: string;
	signInHref: string;
}): Raw {
	return html`<bd-post-like data-like-url="${opts.likeUrl}" data-sign-in-href="${opts.signInHref}">
		${jsonScript({ likes: opts.likes, signedIn: opts.signedIn })}
	</bd-post-like>`;
}
