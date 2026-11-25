// [bd-file:blog]
import type {
	BlogLikeResponse,
	BlogPublicComment,
} from "@businessdash/sdk/contracts";
import { type FormEvent, useState } from "react";
import { BdLink } from "../bd-link";
import { formatPostDate } from "./blog";

export type BlogPostData = {
	post: {
		title: string;
		slug: string;
		excerpt: string | null;
		imageUrl: string | null;
		publishedAt: string | null;
		authorName: string | null;
		authorAvatarUrl: string | null;
		tags: string[];
		ctaLabel: string | null;
		ctaHref: string | null;
		ctaDescription: string | null;
	};
	/** The post body, already rebuilt by `safePostHtml` on the server. */
	html: string;
	minutes: number;
	paywalled: boolean;
	likes: BlogLikeResponse;
	comments: BlogPublicComment[];
	signedIn: boolean;
};

export type CommentResult =
	| { ok: true; approved: boolean; comments: BlogPublicComment[] }
	| { ok: false; error: string };

/**
 * One post: its body, likes and comments. Liking and commenting need a
 * signed-in customer; signed out, they lead to sign-in and back. The page
 * passes `onLike` and `onComment`, so each framework calls its own server.
 */
export function BlogPost({
	data,
	signInHref,
	onLike,
	onComment,
}: {
	data: BlogPostData;
	signInHref: string;
	onLike: () => Promise<BlogLikeResponse | { error: string }>;
	onComment: (content: string) => Promise<CommentResult>;
}) {
	const { post } = data;
	const [likes, setLikes] = useState(data.likes);
	const [likeError, setLikeError] = useState("");
	const [comments, setComments] = useState(data.comments);
	const [draft, setDraft] = useState("");
	const [posting, setPosting] = useState(false);
	const [note, setNote] = useState<{
		kind: "ok" | "error";
		text: string;
	} | null>(null);

	async function like() {
		setLikeError("");
		const res = await onLike();
		if ("error" in res) setLikeError(res.error);
		else setLikes(res);
	}

	async function comment(event: FormEvent) {
		event.preventDefault();
		const content = draft.trim();
		if (!content) return;
		setPosting(true);
		setNote(null);
		const res = await onComment(content);
		setPosting(false);
		if (!res.ok) {
			setNote({ kind: "error", text: res.error });
			return;
		}
		setDraft("");
		setComments(res.comments);
		setNote({
			kind: "ok",
			text: res.approved
				? "Comment posted."
				: "Thanks! Your comment shows once it's approved.",
		});
	}

	return (
		<>
			<article className="post">
				<BdLink className="post__back" href="/blog">
					← All posts
				</BdLink>
				<header className="post__head">
					<h1>{post.title}</h1>
					<p className="post__meta">
						{post.authorAvatarUrl && (
							<img
								alt=""
								referrerPolicy="no-referrer"
								src={post.authorAvatarUrl}
							/>
						)}
						{post.authorName && <span>{post.authorName}</span>}
						<span>{formatPostDate(post.publishedAt)}</span>
						<span>· {data.minutes} min read</span>
					</p>
				</header>

				{post.imageUrl && (
					<img
						alt=""
						className="post__cover"
						referrerPolicy="no-referrer"
						src={post.imageUrl}
					/>
				)}

				{data.paywalled ? (
					<div className="bd-empty">
						This post is for members.
						<p>
							<BdLink className="bd-btn" href={signInHref}>
								Sign in to read it
							</BdLink>
						</p>
					</div>
				) : (
					<div
						className="post__body"
						// biome-ignore lint/security/noDangerouslySetInnerHtml: rebuilt from an allowlist on the server (see ./blog)
						dangerouslySetInnerHTML={{ __html: data.html }}
					/>
				)}

				{post.ctaHref && post.ctaLabel && (
					<aside className="bd-card post__cta">
						{post.ctaDescription && <p>{post.ctaDescription}</p>}
						<a className="bd-btn" href={post.ctaHref}>
							{post.ctaLabel}
						</a>
					</aside>
				)}

				{post.tags.length > 0 && (
					<ul className="post__tags">
						{post.tags.map((tag) => (
							<li key={tag}>
								<BdLink href={`/blog?tag=${encodeURIComponent(tag)}`}>
									#{tag}
								</BdLink>
							</li>
						))}
					</ul>
				)}

				<div className="post__like">
					{data.signedIn ? (
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
					{likeError && (
						<span className="post__error" role="alert">
							{likeError}
						</span>
					)}
				</div>
			</article>

			<section aria-labelledby="comments-title" className="comments">
				<h2 id="comments-title">
					{comments.length} {comments.length === 1 ? "comment" : "comments"}
				</h2>

				{data.signedIn ? (
					<form className="comments__form" onSubmit={comment}>
						<label className="bd-label" htmlFor="comment">
							Add a comment
						</label>
						<textarea
							className="bd-textarea"
							id="comment"
							maxLength={5000}
							name="content"
							onChange={(e) => setDraft(e.target.value)}
							required
							rows={4}
							value={draft}
						/>
						<button className="bd-btn" disabled={posting} type="submit">
							{posting ? "Posting…" : "Post comment"}
						</button>
						{note && (
							<p
								className={note.kind === "ok" ? "comments__ok" : "post__error"}
								role={note.kind === "ok" ? "status" : "alert"}
							>
								{note.text}
							</p>
						)}
					</form>
				) : (
					<p className="comments__signin">
						<BdLink className="bd-btn bd-btn--ghost" href={signInHref}>
							Sign in to comment
						</BdLink>
					</p>
				)}

				{comments.length > 0 && (
					<ol className="comments__list">
						{comments.map((c) => (
							<li
								className={`comment${c.parentId !== null ? " comment--reply" : ""}`}
								key={c.id}
							>
								<p className="comment__head">
									<strong>{c.authorName ?? "Reader"}</strong>
									<span>{formatPostDate(c.createdAt)}</span>
								</p>
								<p className="comment__body">{c.content}</p>
							</li>
						))}
					</ol>
				)}
			</section>
		</>
	);
}
