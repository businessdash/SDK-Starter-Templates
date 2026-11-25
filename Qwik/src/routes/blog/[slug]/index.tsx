// [bd-file:blog]
import { component$, useVisibleTask$ } from "@builder.io/qwik";
import { type DocumentHead, Link, routeLoader$ } from "@builder.io/qwik-city";

import { Footer } from "../../../components/bd/Footer";
import { SiteHeader } from "../../../components/bd/SiteHeader";
import { getBd } from "../../../lib/bd";
import { elementHtml } from "../../../lib/bd-elements";
import { getCustomerSession } from "../../../lib/bd-portal";
import { formatPostDate, readingMinutes, safePostHtml } from "../../../lib/shop/blog";

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
	const result = bd ? await bd.blog.getPost(params.slug).catch(() => null) : null;
	if (!bd || !result) {
		status(404);
		return { found: false as const, signedIn: !!session };
	}
	const [likes, comments] = await Promise.all([
		(session ? bd.blog.withSession(session.token) : bd.blog).likeStatus(params.slug).catch(() => null),
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
						<p class="post__meta">
							{v.post.authorAvatarUrl ? <img alt="" referrerPolicy="no-referrer" src={v.post.authorAvatarUrl} /> : null}
							{v.post.authorName ? <span>{v.post.authorName}</span> : null}
							<span>{formatPostDate(v.post.publishedAt)}</span>
							<span>· {v.minutes} min read</span>
						</p>
					</header>
					{v.post.imageUrl ? <img alt="" class="post__cover" referrerPolicy="no-referrer" src={v.post.imageUrl} /> : null}
					{v.paywalled ? (
						<div class="bd-empty">
							This post is for members.
							<p>
								<a class="bd-btn" href={signInHref}>
									Sign in to read it
								</a>
							</p>
						</div>
					) : (
						// Rebuilt from an allowlist in the loader: see src/lib/shop/blog.ts.
						<div class="post__body" dangerouslySetInnerHTML={v.html} />
					)}
					{v.post.ctaHref && v.post.ctaLabel ? (
						<aside class="bd-card post__cta">
							{v.post.ctaDescription ? <p>{v.post.ctaDescription}</p> : null}
							<a class="bd-btn" href={v.post.ctaHref}>
								{v.post.ctaLabel}
							</a>
						</aside>
					) : null}
					{v.post.tags.length > 0 ? (
						<ul class="post__tags">
							{v.post.tags.map((t) => (
								<li key={t}>
									<Link href={`/blog?tag=${encodeURIComponent(t)}`}>#{t}</Link>
								</li>
							))}
						</ul>
					) : null}
					<div
						dangerouslySetInnerHTML={elementHtml(
							"bd-post-like",
							{ "data-like-url": `${api}/like`, "data-sign-in-href": signInHref },
							{ likes: v.likes, signedIn: v.signedIn },
						)}
					/>
				</article>
				<div
					dangerouslySetInnerHTML={elementHtml(
						"bd-post-comments",
						{ "data-comment-url": `${api}/comment`, "data-sign-in-href": signInHref },
						{ comments: v.comments, signedIn: v.signedIn },
					)}
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
			...(data.post.excerpt ? [{ name: "description", content: data.post.excerpt }] : []),
			{ property: "og:type", content: "article" },
			{ property: "og:title", content: data.post.title },
			{ property: "og:url", content: canonical },
			...(data.post.imageUrl ? [{ property: "og:image", content: data.post.imageUrl }] : []),
		],
		links: [{ rel: "canonical", href: canonical }],
	};
};
