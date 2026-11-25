// [bd-file:blog]
import { createFileRoute, Link } from "@tanstack/solid-router";
import { Show } from "solid-js";

import { Comments } from "../components/bd/blog/Comments";
import { LikeButton } from "../components/bd/blog/LikeButton";
import { MembersOnly } from "../components/bd/blog/MembersOnly";
import { PostBody } from "../components/bd/blog/PostBody";
import { PostCta } from "../components/bd/blog/PostCta";
import { PostMeta } from "../components/bd/blog/PostMeta";
import { PostTags } from "../components/bd/blog/PostTags";
import { getBlogPost } from "../lib/bd-blog-fns";
import { loadBlogElements } from "../lib/bd-elements";

/**
 * One post. The server rebuilds its HTML from an allowlist (`safePostHtml`,
 * src/lib/shop/blog.ts) and only that reaches the page. Likes and comments
 * are for signed-in customers: `<bd-post-like>` and `<bd-post-comments>`
 * (src/lib/shop/blog-elements.ts) post JSON to
 * /api/bd/blog/post/:slug/like and /comment; signed out, they lead to
 * sign-in and back to the post.
 *
 * The page is laid out from the blog's parts (src/components/bd/blog/), one
 * file each: move, restyle or drop any.
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
									<PostMeta
										authorAvatarUrl={v().post.authorAvatarUrl}
										authorName={v().post.authorName}
										minutes={v().minutes}
										publishedAt={v().post.publishedAt}
									/>
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
									fallback={<MembersOnly signInHref={signInHref()} />}
								>
									<PostBody html={v().html} />
								</Show>
								<Show when={v().post.ctaHref && v().post.ctaLabel}>
									<PostCta
										description={v().post.ctaDescription}
										href={v().post.ctaHref ?? ""}
										label={v().post.ctaLabel ?? ""}
									/>
								</Show>
								<PostTags tags={v().post.tags} />
								<LikeButton
									likes={v().likes}
									likeUrl={`${api()}/like`}
									signedIn={v().signedIn}
									signInHref={signInHref()}
								/>
							</article>
							<Comments
								commentUrl={`${api()}/comment`}
								comments={v().comments}
								signedIn={v().signedIn}
								signInHref={signInHref()}
							/>
						</>
					);
				}}
			</Show>
		</main>
	);
}
