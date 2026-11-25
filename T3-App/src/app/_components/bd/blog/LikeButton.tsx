// [bd-file:blog]
"use client";
import type { BlogLikeResponse } from "@businessdash/sdk/contracts";
import { useState } from "react";
import { BdLink } from "../bd-link";

/**
 * Like (or unlike) the post, and how many have. Signed out, it's a link to
 * sign in. `onLike` is the page's call to its server.
 */
export function LikeButton({
	initial,
	signedIn,
	signInHref,
	onLike,
}: {
	initial: BlogLikeResponse;
	signedIn: boolean;
	signInHref: string;
	onLike: () => Promise<BlogLikeResponse | { error: string }>;
}) {
	const [likes, setLikes] = useState(initial);
	const [error, setError] = useState("");

	async function like() {
		setError("");
		const res = await onLike();
		if ("error" in res) setError(res.error);
		else setLikes(res);
	}

	return (
		<div className="post__like">
			{signedIn ? (
				<button
					aria-pressed={likes.liked}
					className={`like${likes.liked ? " like--on" : ""}`}
					onClick={like}
					type="button"
				>
					<span aria-hidden="true">{likes.liked ? "♥" : "♡"}</span>
					{likes.liked ? "Liked" : "Like"}
				</button>
			) : (
				<BdLink className="like" href={signInHref}>
					<span aria-hidden="true">♡</span> Sign in to like
				</BdLink>
			)}
			<span className="post__likes">
				{likes.likesCount} {likes.likesCount === 1 ? "like" : "likes"}
			</span>
			{error && (
				<span className="post__error" role="alert">
					{error}
				</span>
			)}
		</div>
	);
}
