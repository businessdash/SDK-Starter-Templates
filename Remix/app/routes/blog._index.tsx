// [bd-file:blog]
import { useLoaderData } from "react-router";
import type {
	LinksFunction,
	LoaderFunctionArgs,
	MetaFunction,
} from "react-router";

import blogStyles from "~/bd-blog.css?url";
import { BlogIndex } from "~/components/blog/BlogIndex";
import { SiteHeader } from "~/components/SiteHeader";
import {
	isBlogConfigured,
	listBlogCategories,
	listBlogPosts,
	listBlogTags,
} from "~/lib/bd-blog.server";

export const links: LinksFunction = () => [
	{ rel: "stylesheet", href: blogStyles },
];

export const meta: MetaFunction = () => [{ title: "Blog — Your Business" }];

/** Posts on a page. With a tag filter, more are read and filtered here. */
const PAGE = 12;

/**
 * The blog: posts newest first (pinned ones lead the first page), with
 * category and tag filters and "Older posts" paging, all in the URL
 * (?category, ?tag, ?cursor).
 */
export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url);
	const categoryId = url.searchParams.get("category") || null;
	const tag = url.searchParams.get("tag") || null;
	const rawCursor = Number.parseInt(url.searchParams.get("cursor") ?? "", 10);
	const cursor = Number.isFinite(rawCursor) ? rawCursor : null;

	if (!isBlogConfigured()) {
		return {
			configured: false,
			posts: [],
			categories: [],
			tags: [],
			categoryId,
			tag,
			nextCursor: null,
			paged: false,
		};
	}
	const [page, categories, tags] = await Promise.all([
		listBlogPosts({
			limit: tag ? 50 : PAGE,
			cursor,
			...(categoryId ? { categoryId } : {}),
		}),
		listBlogCategories(),
		listBlogTags(),
	]);
	const posts = (page?.items ?? []).filter(
		(post) => !tag || post.tags.includes(tag),
	);
	return {
		configured: true,
		posts:
			cursor === null
				? [...posts].sort((a, b) => Number(b.isPinned) - Number(a.isPinned))
				: posts,
		categories,
		tags,
		categoryId,
		tag,
		nextCursor: page?.nextCursor ?? null,
		paged: cursor !== null,
	};
}

export default function BlogPage() {
	const { configured, ...index } = useLoaderData<typeof loader>();
	return (
		<>
			<SiteHeader />
			<main className="bd-page">
				{configured ? (
					<BlogIndex {...index} />
				) : (
					<div className="bd-empty">
						The blog isn't connected yet. Add your BD env, then publish a post
						in Business Dash.
					</div>
				)}
			</main>
		</>
	);
}
