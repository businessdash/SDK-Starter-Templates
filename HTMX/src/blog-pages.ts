// [bd-file:blog]
/**
 * The blog, rendered here on the server.
 *
 * - /blog: posts newest first (pinned ones lead the first page), with
 *   category and tag filters and "Older posts" paging, all in the URL
 *   (?category, ?tag, ?cursor), so it is plain links.
 * - /blog/:slug: one post. Its HTML is rebuilt from an allowlist here
 *   (`safePostHtml`, src/shop/blog.ts) and only that reaches the page. Likes
 *   and comments are for signed-in customers: `<bd-post-like>` and
 *   `<bd-post-comments>` (src/shop/blog-elements.ts) post JSON to
 *   /blog/:slug/like and /blog/:slug/comment; signed out, they lead to
 *   sign-in and back to the post.
 *
 * The pages are laid out from the blog's parts in src/sections/blog/, one
 * file each: the filters and a post card for the list; meta, body (or
 * members-only), call to action, tags, like button and comments for a post.
 */
import { getBd, getSession } from "./bd";
import { cached } from "./cache";
import { html, type Raw } from "./html";
import { SESSION_COOKIE, errBlock, getCookie, page } from "./layout";
import { blogFilters } from "./sections/blog/blog-filters";
import { comments as commentList } from "./sections/blog/comments";
import { likeButton } from "./sections/blog/like-button";
import { membersOnly } from "./sections/blog/members-only";
import { postBody } from "./sections/blog/post-body";
import { postCard } from "./sections/blog/post-card";
import { postCta } from "./sections/blog/post-cta";
import { postMeta } from "./sections/blog/post-meta";
import { postTags } from "./sections/blog/post-tags";
import { readingMinutes } from "./shop/blog";

const BLOG_CSS = ["/bd-blog.css"];
const BLOG_MODULES = ["/shop/blog-elements.js"];

/** Posts on a page. With a tag filter, more are read and filtered here. */
const PAGE = 12;

// ── the post list ──────────────────────────────────────────────────

export async function blogIndexPage(url: URL): Promise<string> {
	const params = url.searchParams;
	const categoryId = params.get("category") || null;
	const tag = params.get("tag") || null;
	const rawCursor = Number.parseInt(params.get("cursor") ?? "", 10);
	const cursor = Number.isFinite(rawCursor) ? rawCursor : null;
	const paged = cursor !== null;

	const nextHref = (next: number): string => {
		const query = new URLSearchParams();
		if (categoryId) query.set("category", categoryId);
		query.set("cursor", String(next));
		return `/blog?${query}`;
	};

	const bd = getBd();
	let body: Raw;
	let title = "Blog — Your Business";
	let description = "News, guides and stories.";
	if (!bd) {
		body = html`<div class="bd-empty">The blog isn't connected yet. Add your BD env, then publish a post in Business Dash.</div>`;
	} else {
		try {
			const [list, categories, tags] = await Promise.all([
				cached(`blog:posts:${categoryId ?? ""}:${cursor ?? ""}:${tag ? "tag" : ""}`, ["bd:blog"], () =>
					bd.blog.listPosts({ limit: tag ? 50 : PAGE, cursor, ...(categoryId ? { categoryId } : {}) }),
				),
				cached("blog:categories", ["bd:blog"], () => bd.blog.listCategories())
					.then((res) => res.items)
					.catch(() => []),
				cached("blog:tags", ["bd:blog"], () => bd.blog.listTags())
					.then((res) => res.items)
					.catch(() => [] as string[]),
			]);
			const filtered = list.items.filter((post) => !tag || post.tags.includes(tag));
			const posts = paged ? filtered : [...filtered].sort((a, b) => Number(b.isPinned) - Number(a.isPinned));
			const active = categories.find((c) => c.id === categoryId);
			if (active) {
				title = `${active.name} — Blog`;
				if (active.description) description = active.description;
			}

			const filters = blogFilters({ categories, tags, category: categoryId, tag });

			const items =
				posts.length === 0
					? html`<div class="bd-empty">${
							tag || categoryId ? "No posts here yet." : "No posts published yet. Write one in Business Dash and it'll appear here."
						}</div>`
					: html`<ul class="posts">
							${posts.map((post, i) => postCard(post, { lead: i === 0 && !paged }))}
						</ul>
						${
							list.nextCursor != null && !tag
								? html`<p class="posts__more"><a class="bd-btn bd-btn--ghost" href="${nextHref(list.nextCursor)}">Older posts</a></p>`
								: ""
						}`;

			body = html`<div class="bd-section__lead">
					<span class="bd-section__eyebrow">Blog</span>
					<h1 class="bd-section__title">${active?.name ?? "From the blog"}</h1>
					${active?.description ? html`<p class="bd-section__sub">${active.description}</p>` : ""}
				</div>
				${filters}
				${items}`;
		} catch (err) {
			body = errBlock(err);
		}
	}

	return page({ origin: url.origin, title, description, styles: BLOG_CSS, mainClass: "bd-page", body });
}

// ── one post ───────────────────────────────────────────────────────

export async function blogPostPage(url: URL, slug: string, sessionCookie: string | null): Promise<{ html: string; status: number }> {
	const bd = getBd();
	type Found = Awaited<ReturnType<NonNullable<typeof bd>["blog"]["getPost"]>>;
	let found: Found | null = null;
	let failure: unknown = null;
	if (bd) {
		try {
			found = await cached(`blog:post:${slug}`, ["bd:blog", `bd:blog:${slug}`], () => bd.blog.getPost(slug));
		} catch (err) {
			failure = err;
		}
	}
	const post = found?.post ?? null;

	let body: Raw;
	if (!bd) {
		body = errBlock(new Error("BD not configured"));
	} else if (!post) {
		body = /Suspended|Lapsed|unavailable|\b503\b/i.test(String(failure))
			? errBlock(failure)
			: html`<div class="bd-empty">That post isn't available. <a href="/blog">See all posts</a></div>`;
	} else {
		const session = await getSession(sessionCookie);
		const [likes, comments] = await Promise.all([
			(session ? bd.blog.withSession(session.token) : bd.blog).likeStatus(slug).catch(() => null),
			bd.blog.listComments(slug, { limit: 50 }).catch(() => ({ items: [] })),
		]);
		const signedIn = session !== null;
		const here = `/blog/${encodeURIComponent(slug)}`;
		const signInHref = `/my-account?next=${encodeURIComponent(here)}`;
		const paywalled = found?.access === "paywall";

		body = html`<article class="post">
				<a class="post__back" href="/blog">← All posts</a>
				<header class="post__head">
					<h1>${post.title}</h1>
					${postMeta(post, readingMinutes(post.content))}
				</header>
				${post.imageUrl ? html`<img alt="" class="post__cover" referrerpolicy="no-referrer" src="${post.imageUrl}" />` : ""}
				${paywalled ? membersOnly(signInHref) : postBody(post.content)}
				${postCta(post)}
				${postTags(post.tags)}
				${likeButton({ likes: likes ?? { liked: false, likesCount: post.likes }, signedIn, likeUrl: `${here}/like`, signInHref })}
			</article>
			${commentList({ comments: comments.items, signedIn, commentUrl: `${here}/comment`, signInHref })}`;
	}

	return {
		status: bd && !post ? 404 : 200,
		html: await page({
			origin: url.origin,
			title: post ? `${post.title} — Blog` : "Post not found",
			description: post?.excerpt ?? "A post from the blog.",
			image: post?.imageUrl ?? null,
			styles: BLOG_CSS,
			modules: post ? BLOG_MODULES : [],
			mainClass: "bd-page",
			body,
		}),
	};
}

// ── likes + comments ───────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
	});
}

/** Like or unlike, for the signed-in customer: `{ liked, likesCount }` or `{ error }`. */
export async function likePost(req: Request, slug: string): Promise<Response> {
	const bd = getBd();
	if (!bd) return json({ error: "The blog isn't connected yet." }, 503);
	// A JSON body only: a form on another site can't send one.
	if (!req.headers.get("content-type")?.includes("application/json")) return json({ error: "Send JSON." }, 415);
	const token = getCookie(req, SESSION_COOKIE);
	if (!token) return json({ error: "Sign in to like posts." }, 401);
	try {
		return json(await bd.blog.withSession(token).toggleLike(slug));
	} catch {
		return json({ error: "Couldn't save your like. Try again." }, 502);
	}
}

/** `{ content }` in; out, whether it shows now or waits for approval, and the
 *  comments as they are now. */
export async function commentOnPost(req: Request, slug: string): Promise<Response> {
	const bd = getBd();
	if (!bd) return json({ ok: false, error: "The blog isn't connected yet." }, 503);
	if (!req.headers.get("content-type")?.includes("application/json")) return json({ ok: false, error: "Send JSON." }, 415);
	const token = getCookie(req, SESSION_COOKIE);
	if (!token) return json({ ok: false, error: "Sign in to comment." }, 401);
	const body = (await req.json().catch(() => null)) as { content?: unknown } | null;
	const content = typeof body?.content === "string" ? body.content.trim() : "";
	if (!content) return json({ ok: false, error: "Write something first." }, 400);
	if (content.length > 5000) return json({ ok: false, error: "Comments are up to 5,000 characters." }, 400);
	try {
		const res = await bd.blog.withSession(token).postComment(slug, { content });
		const comments = await bd.blog.listComments(slug, { limit: 50 });
		return json({ ok: true, approved: res.moderation.isApproved, comments: comments.items });
	} catch {
		return json({ ok: false, error: "Couldn't post your comment. Try again." }, 502);
	}
}
