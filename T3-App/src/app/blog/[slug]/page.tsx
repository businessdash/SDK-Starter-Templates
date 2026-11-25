// [bd-file:blog]
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { commentOnPostAction, likePostAction } from "@/app/_actions/blog";
import { BlogPost } from "@/app/_components/bd/blog/BlogPost";
import { readingMinutes, safePostHtml } from "@/app/_components/bd/blog/blog";
import {
	getBlogLikes,
	getBlogPost,
	listBlogComments,
} from "@/server/lib/bd-blog";
import { getCustomerSession } from "@/server/lib/bd-portal";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const result = await getBlogPost((await params).slug);
	if (!result) return { title: "Post not found" };
	const { post } = result;
	return {
		title: post.title,
		description: post.excerpt ?? undefined,
		openGraph: post.imageUrl ? { images: [post.imageUrl] } : undefined,
	};
}

/**
 * One post. Its HTML is rebuilt from an allowlist on the server
 * (`safePostHtml`) and only that reaches the page. Likes and comments are
 * for signed-in customers; signed out, they lead to sign-in and back here.
 */
export default async function BlogPostPage({ params }: Props) {
	const { slug } = await params;
	const result = await getBlogPost(slug);
	if (!result) notFound();
	const session = await getCustomerSession().catch(() => null);
	const [likes, comments] = await Promise.all([
		getBlogLikes(slug, session?.token ?? null),
		listBlogComments(slug),
	]);
	const { post, access } = result;

	return (
		<BlogPost
			data={{
				post: {
					title: post.title,
					slug: post.slug,
					excerpt: post.excerpt,
					imageUrl: post.imageUrl,
					publishedAt: post.publishedAt,
					authorName: post.authorName,
					authorAvatarUrl: post.authorAvatarUrl,
					tags: post.tags,
					ctaLabel: post.ctaLabel,
					ctaHref: post.ctaHref,
					ctaDescription: post.ctaDescription,
				},
				html: safePostHtml(post.content),
				minutes: readingMinutes(post.content),
				paywalled: access === "paywall",
				likes: likes ?? { liked: false, likesCount: post.likes },
				comments: comments.items,
				signedIn: session !== null,
			}}
			onComment={commentOnPostAction.bind(null, slug)}
			onLike={likePostAction.bind(null, slug)}
			signInHref={`/my-account?next=${encodeURIComponent(`/blog/${slug}`)}`}
		/>
	);
}
