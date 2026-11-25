// [bd-file:blog]
import type { BlogLikeResponse } from "@businessdash/sdk/contracts";

import { elementHtml } from "../../../lib/bd-elements";

/**
 * ♡ Like with the count. Signed out, it leads to sign-in and back. It's
 * `<bd-post-like>` (src/lib/shop/blog-elements.ts), written as HTML so Qwik
 * leaves what it draws alone.
 */
export function LikeButton({
	likes,
	signedIn,
	likeUrl,
	signInHref,
}: {
	likes: BlogLikeResponse;
	signedIn: boolean;
	likeUrl: string;
	signInHref: string;
}) {
	return (
		<div
			dangerouslySetInnerHTML={elementHtml(
				"bd-post-like",
				{ "data-like-url": likeUrl, "data-sign-in-href": signInHref },
				{ likes, signedIn },
			)}
		/>
	);
}
