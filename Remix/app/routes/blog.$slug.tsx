// [bd-file:blog]
import { data, useLoaderData } from "react-router";
import type {
	LinksFunction,
	LoaderFunctionArgs,
	MetaFunction,
} from "react-router";

import blogStyles from "~/bd-blog.css?url";
import { readingMinutes, safePostHtml } from "~/components/blog/blog";
import { BlogPost, type CommentResult } from "~/components/blog/BlogPost";
import { SiteHeader } from "~/components/SiteHeader";
import {
	getBlogLikes,
	getBlogPost,
	listBlogComments,
} from "~/lib/bd-blog.server";
import { getCustomerSession } from "~/lib/bd-portal.server";

export const links: LinksFunction = () => [
	{ rel: "stylesheet", href: blogStyles },
];

export const meta: MetaFunction<typeof loader> = ({ data }) =>
	data?.post
		? [
				{ title: `${data.post.title} — Blog` },
				...(data.post.excerpt
					? [{ name: "description", content: data.post.excerpt }]
					: []),
				...(data.post.imageUrl
					? [{ property: "og:image", content: data.post.imageUrl }]
					: []),
			]
		: [{ title: "Post not found" }];

/**
 * One post. Its HTML is rebuilt from an allowlist on the server
 * (`safePostHtml`) and only that reaches the page. Likes and comments are
 * for signed-in customers, through /api/blog/:slug/{like,comment}; signed
 * out, they lead to sign-in and back here.
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
	const slug = params["slug"] ?? "";
	const result = await getBlogPost(slug);
	if (!result) throw data("Post not found", { status: 404 });
	const session = await getCustomerSession(request);
	const [likes, comments] = await Promise.all([
		getBlogLikes(slug, session?.token ?? null),
		listBlogComments(slug),
	]);
	const { post, access } = result;
	return {
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
	};
}

async function postJson<T>(url: string, body?: unknown): Promise<T | null> {
	try {
		const res = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body ?? {}),
		});
		return (await res.json()) as T;
	} catch {
		return null;
	}
}

export default function BlogPostPage() {
	const page = useLoaderData<typeof loader>();
	const slug = encodeURIComponent(page.post.slug);
	return (
		<>
			<SiteHeader />
			<main className="bd-page">
				<BlogPost
					data={page}
					key={page.post.slug}
					onComment={async (content) =>
						(await postJson<CommentResult>(`/api/blog/${slug}/comment`, {
							content,
						})) ?? { ok: false, error: "Couldn't post your comment. Try again." }
					}
					onLike={async () =>
						(await postJson<{ liked: boolean; likesCount: number } | { error: string }>(
							`/api/blog/${slug}/like`,
						)) ?? { error: "Couldn't save your like. Try again." }
					}
					signInHref={`/my-account?next=${encodeURIComponent(`/blog/${page.post.slug}`)}`}
				/>
			</main>
		</>
	);
}
