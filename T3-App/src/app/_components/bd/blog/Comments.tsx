// [bd-file:blog]
"use client";
import type { BlogPublicComment } from "@businessdash/sdk/contracts";
import { useState } from "react";
import { BdLink } from "../bd-link";
import type { CommentResult } from "./BlogPost";
import { CommentForm } from "./CommentForm";
import { CommentList } from "./CommentList";

/** The comments section: how many, the form (or sign in), and the comments. */
export function Comments({
	initial,
	signedIn,
	signInHref,
	onComment,
}: {
	initial: BlogPublicComment[];
	signedIn: boolean;
	signInHref: string;
	onComment: (content: string) => Promise<CommentResult>;
}) {
	const [comments, setComments] = useState(initial);
	return (
		<section aria-labelledby="comments-title" className="comments">
			<h2 id="comments-title">
				{comments.length} {comments.length === 1 ? "comment" : "comments"}
			</h2>
			{signedIn ? (
				<CommentForm onComment={onComment} onPosted={setComments} />
			) : (
				<p className="comments__signin">
					<BdLink className="bd-btn bd-btn--ghost" href={signInHref}>
						Sign in to comment
					</BdLink>
				</p>
			)}
			<CommentList comments={comments} />
		</section>
	);
}
