// [bd-file:blog]
import { component$, useVisibleTask$ } from "@builder.io/qwik";
import { type DocumentHead, Link, routeLoader$ } from "@builder.io/qwik-city";

import { Comments } from "../../../components/bd/blog/Comments";
import { LikeButton } from "../../../components/bd/blog/LikeButton";
import { MembersOnly } from "../../../components/bd/blog/MembersOnly";
import { PostBody } from "../../../components/bd/blog/PostBody";
import { PostCta } from "../../../components/bd/blog/PostCta";
import { PostMeta } from "../../../components/bd/blog/PostMeta";
import { PostTags } from "../../../components/bd/blog/PostTags";
import { Footer } from "../../../components/bd/Footer";
import { SiteHeader } from "../../../components/bd/SiteHeader";
import { getBd } from "../../../lib/bd";
import { getCustomerSession } from "../../../lib/bd-portal";
import { readingMinutes, safePostHtml } from "../../../lib/shop/blog";

/**
 * One post. The loader rebuilds its HTML from an allowlist (`safePostHtml`,
 * src/lib/shop/blog.ts) so the raw HTML never reaches the page. Likes and
 * comments are for signed-in customers: `<bd-post-like>` and
 * `<bd-post-comments>` (src/lib/shop/blog-elements.ts) post JSON to
 * /api/bd/blog/post/:slug/like and /comment; signed out, they lead to
 * sign-in and back to the post.
 */
export const usePost = routeLoader$(async ({ params, cookie, status }) => {
	const bd = getBd();
	const session = await getCustomerSession(cookie);
	const result = bd
		? await bd.blog.getPost(params.slug).catch(() => null)
		: null;
	if (!bd || !result) {
		status(404);
		return { found: false as const, signedIn: !!session };
	}
	const [likes, comments] = await Promise.all([
		(session ? bd.blog.withSession(session.token) : bd.blog)
			.likeStatus(params.slug)
			.catch(() => null),
		bd.blog
			.listComments(params.slug, { limit: 50 })
			.then((res) => res.items)
			.catch(() => []),
	]);
	const { post, access } = result;
	return {
		found: true as const,
		signedIn: !!session,
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
		comments,
	};
});

export default component$(() => {
	const data = usePost();

	// eslint-disable-next-line qwik/no-use-visible-task
	useVisibleTask$(
		() => {
			void import("../../../lib/shop/blog-elements");
		},
		{ strategy: "document-ready" },
	);

	const v = data.value;
	if (!v.found) {
		return (
			<>
				<SiteHeader signedIn={v.signedIn} />
				<main class="bd-page">
					<div class="bd-empty">
						That post isn't available. <Link href="/blog">See all posts</Link>
					</div>
				</main>
				<Footer />
			</>
		);
	}
	const here = `/blog/${encodeURIComponent(v.post.slug)}`;
	const api = `/api/bd/blog/post/${encodeURIComponent(v.post.slug)}`;
	const signInHref = `/my-account?next=${encodeURIComponent(here)}`;

	return (
		<>
			<SiteHeader signedIn={v.signedIn} />
			<main class="bd-page">
				<article class="post">
					<Link class="post__back" href="/blog">
						← All posts
					</Link>
					<header class="post__head">
						<h1>{v.post.title}</h1>
						<PostMeta
							authorAvatarUrl={v.post.authorAvatarUrl}
							authorName={v.post.authorName}
							minutes={v.minutes}
							publishedAt={v.post.publishedAt}
						/>
					</header>
					{v.post.imageUrl ? (
						<img
							width={1600}
							height={900}
							alt=""
							class="post__cover"
							referrerPolicy="no-referrer"
							src={v.post.imageUrl}
						/>
					) : null}
					{v.paywalled ? (
						<MembersOnly signInHref={signInHref} />
					) : (
						// Rebuilt from an allowlist in the loader: see src/lib/shop/blog.ts.
						<PostBody html={v.html} />
					)}
					{v.post.ctaHref && v.post.ctaLabel ? (
						<PostCta
							description={v.post.ctaDescription}
							href={v.post.ctaHref}
							label={v.post.ctaLabel}
						/>
					) : null}
					<PostTags tags={v.post.tags} />
					<LikeButton
						likeUrl={`${api}/like`}
						likes={v.likes}
						signInHref={signInHref}
						signedIn={v.signedIn}
					/>
				</article>
				<Comments
					commentUrl={`${api}/comment`}
					comments={v.comments}
					signInHref={signInHref}
					signedIn={v.signedIn}
				/>
			</main>
			<Footer />
		</>
	);
});

export const head: DocumentHead = ({ resolveValue, url }) => {
	const data = resolveValue(usePost);
	if (!data.found) return { title: "Post not found — Your Business" };
	const canonical = url.origin + url.pathname;
	return {
		title: `${data.post.title} — Your Business`,
		meta: [
			...(data.post.excerpt
				? [{ name: "description", content: data.post.excerpt }]
				: []),
			{ property: "og:type", content: "article" },
			{ property: "og:title", content: data.post.title },
			{ property: "og:url", content: canonical },
			...(data.post.imageUrl
				? [{ property: "og:image", content: data.post.imageUrl }]
				: []),
		],
		links: [{ rel: "canonical", href: canonical }],
	};
};
