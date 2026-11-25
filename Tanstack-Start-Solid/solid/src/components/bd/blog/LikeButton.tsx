// [bd-file:blog]
import type { BlogLikeResponse } from "@businessdash/sdk/contracts";

import { elementHtml } from "../../../lib/bd-elements";

/**
 * ♡ Like and the count. `<bd-post-like>` (src/lib/shop/blog-elements.ts)
 * posts to `likeUrl`; signed out, it leads to sign-in and back.
 */
export function LikeButton(props: {
	likes: BlogLikeResponse;
	signedIn: boolean;
	likeUrl: string;
	signInHref: string;
}) {
	return (
		<div
			innerHTML={elementHtml(
				"bd-post-like",
				{ "data-like-url": props.likeUrl, "data-sign-in-href": props.signInHref },
				{ likes: props.likes, signedIn: props.signedIn },
			)}
		/>
	);
}
