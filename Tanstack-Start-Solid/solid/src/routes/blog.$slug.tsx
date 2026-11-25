// [bd-file:blog]
import { createFileRoute, Link } from "@tanstack/solid-router";
import { For, Show } from "solid-js";

import { getBlogPost } from "../lib/bd-blog-fns";
import { elementHtml, loadBlogElements } from "../lib/bd-elements";
import { formatPostDate } from "../lib/shop/blog";

/**
 * One post. The server rebuilds its HTML from an allowlist (`safePostHtml`,
 * src/lib/shop/blog.ts) and only that reaches the page. Likes and comments
 * are for signed-in customers: `<bd-post-like>` and `<bd-post-comments>`
 * (src/lib/shop/blog-elements.ts) post JSON to
 * /api/bd/blog/post/:slug/like and /comment; signed out, they lead to
 * sign-in and back to the post.
 */
export const Route = createFileRoute("/blog/$slug")({
	component: BlogPost,
	loader: ({ params }) => getBlogPost({ data: { slug: params.slug } }),
	head: ({ loaderData }) => {
		if (!loaderData?.found) return { meta: [{ title: "Post not found" }] };
		const { post } = loaderData;
		return {
			meta: [
				{ title: post.title },
				...(post.excerpt
					? [{ name: "description", content: post.excerpt }]
					: []),
				{ property: "og:type", content: "article" },
				{ property: "og:title", content: post.title },
				...(post.imageUrl
					? [{ property: "og:image", content: post.imageUrl }]
					: []),
			],
		};
	},
});

function BlogPost() {
	loadBlogElements();
	const data = Route.useLoaderData();
	const view = () => {
		const d = data();
		return d.found ? d : null;
	};

	return (
		<main class="bd-page">
			<Show
				when={view()}
				fallback={
					<div class="bd-empty">
						That post isn't available. <Link to="/blog">See all posts</Link>
					</div>
				}
			>
				{(v) => {
					const here = () => `/blog/${encodeURIComponent(v().post.slug)}`;
					const api = () =>
						`/api/bd/blog/post/${encodeURIComponent(v().post.slug)}`;
					const signInHref = () =>
						`/my-account?next=${encodeURIComponent(here())}`;
					return (
						<>
							<article class="post">
								<Link class="post__back" to="/blog">
									← All posts
								</Link>
								<header class="post__head">
									<h1>{v().post.title}</h1>
									<p class="post__meta">
										<Show when={v().post.authorAvatarUrl}>
											<img
												alt=""
												referrerpolicy="no-referrer"
												src={v().post.authorAvatarUrl ?? ""}
											/>
										</Show>
										<Show when={v().post.authorName}>
											<span>{v().post.authorName}</span>
										</Show>
										<span>{formatPostDate(v().post.publishedAt)}</span>
										<span>· {v().minutes} min read</span>
									</p>
								</header>
								<Show when={v().post.imageUrl}>
									<img
										alt=""
										class="post__cover"
										referrerpolicy="no-referrer"
										src={v().post.imageUrl ?? ""}
									/>
								</Show>
								<Show
									when={!v().paywalled}
									fallback={
										<div class="bd-empty">
											This post is for members.
											<p>
												<a class="bd-btn" href={signInHref()}>
													Sign in to read it
												</a>
											</p>
										</div>
									}
								>
									{/* Rebuilt from an allowlist on the server: see src/lib/shop/blog.ts. */}
									<div class="post__body" innerHTML={v().html} />
								</Show>
								<Show when={v().post.ctaHref && v().post.ctaLabel}>
									<aside class="bd-card post__cta">
										<Show when={v().post.ctaDescription}>
											<p>{v().post.ctaDescription}</p>
										</Show>
										<a class="bd-btn" href={v().post.ctaHref ?? ""}>
											{v().post.ctaLabel}
										</a>
									</aside>
								</Show>
								<Show when={v().post.tags.length > 0}>
									<ul class="post__tags">
										<For each={v().post.tags}>
											{(t) => (
												<li>
													<Link search={{ tag: t }} to="/blog">
														#{t}
													</Link>
												</li>
											)}
										</For>
									</ul>
								</Show>
								<div
									innerHTML={elementHtml(
										"bd-post-like",
										{
											"data-like-url": `${api()}/like`,
											"data-sign-in-href": signInHref(),
										},
										{ likes: v().likes, signedIn: v().signedIn },
									)}
								/>
							</article>
							<div
								innerHTML={elementHtml(
									"bd-post-comments",
									{
										"data-comment-url": `${api()}/comment`,
										"data-sign-in-href": signInHref(),
									},
									{ comments: v().comments, signedIn: v().signedIn },
								)}
							/>
						</>
					);
				}}
			</Show>
		</main>
	);
}
