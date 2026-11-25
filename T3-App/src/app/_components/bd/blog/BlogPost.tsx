// [bd-file:blog]
"use client";
import type {
	BlogLikeResponse,
	BlogPublicComment,
} from "@businessdash/sdk/contracts";
import { BdLink } from "../bd-link";
import { Comments } from "./Comments";
import { LikeButton } from "./LikeButton";
import { MembersOnly } from "./MembersOnly";
import { PostBody } from "./PostBody";
import { PostCta } from "./PostCta";
import { PostMeta } from "./PostMeta";
import { PostTags } from "./PostTags";

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
 *
 * It's built from the parts imported above, one file each. Use this whole,
 * or lay the parts out your own way on your own post page.
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
	return (
		<>
			<article className="post">
				<BdLink className="post__back" href="/blog">
					← All posts
				</BdLink>
				<header className="post__head">
					<h1>{post.title}</h1>
					<PostMeta
						authorAvatarUrl={post.authorAvatarUrl}
						authorName={post.authorName}
						minutes={data.minutes}
						publishedAt={post.publishedAt}
					/>
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
					<MembersOnly signInHref={signInHref} />
				) : (
					<PostBody html={data.html} />
				)}

				{post.ctaHref && post.ctaLabel && (
					<PostCta
						description={post.ctaDescription}
						href={post.ctaHref}
						label={post.ctaLabel}
					/>
				)}
				<PostTags tags={post.tags} />
				<LikeButton
					initial={data.likes}
					onLike={onLike}
					signedIn={data.signedIn}
					signInHref={signInHref}
				/>
			</article>

			<Comments
				initial={data.comments}
				onComment={onComment}
				signedIn={data.signedIn}
				signInHref={signInHref}
			/>
		</>
	);
}
