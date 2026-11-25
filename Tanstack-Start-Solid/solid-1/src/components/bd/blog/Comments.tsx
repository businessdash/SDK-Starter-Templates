// [bd-file:blog]
import type { BlogPublicComment } from "@businessdash/sdk/contracts";

import { elementHtml } from "../../../lib/bd-elements";

/**
 * The comments and the form to add one. `<bd-post-comments>`
 * (src/lib/shop/blog-elements.ts) posts to `commentUrl`; signed out, the
 * form is a link to sign in.
 */
export function Comments(props: {
	comments: BlogPublicComment[];
	signedIn: boolean;
	commentUrl: string;
	signInHref: string;
}) {
	return (
		<div
			innerHTML={elementHtml(
				"bd-post-comments",
				{
					"data-comment-url": props.commentUrl,
					"data-sign-in-href": props.signInHref,
				},
				{ comments: props.comments, signedIn: props.signedIn },
			)}
		/>
	);
}
