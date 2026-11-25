// [bd-file:blog]
import type { BlogPublicComment } from "@businessdash/sdk/contracts";

import { elementHtml } from "../../../lib/bd-elements";

/**
 * The comments and, signed in, a box to add one; signed out, a link to
 * sign in and back. It's `<bd-post-comments>` (src/lib/shop/blog-elements.ts),
 * written as HTML so Qwik leaves what it draws alone.
 */
export function Comments({
	comments,
	signedIn,
	commentUrl,
	signInHref,
}: {
	comments: BlogPublicComment[];
	signedIn: boolean;
	commentUrl: string;
	signInHref: string;
}) {
	return (
		<div
			dangerouslySetInnerHTML={elementHtml(
				"bd-post-comments",
				{ "data-comment-url": commentUrl, "data-sign-in-href": signInHref },
				{ comments, signedIn },
			)}
		/>
	);
}
