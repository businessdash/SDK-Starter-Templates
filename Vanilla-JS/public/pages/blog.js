// [bd-file:blog]
/**
 * /blog — posts newest first (pinned ones lead the first page), with
 * category and tag filters and "Older posts" paging, all links in the URL
 * (?category, ?tag, ?cursor).
 */
import { formatPostDate, readingMinutes } from "/shop/blog-elements.js";
import { bd, el } from "/bd.js";
import { errBox } from "./_ui.js";

/** Posts on a page. With a tag filter, more are read and filtered here. */
const PAGE = 12;

export default async function render(root) {
	const params = new URLSearchParams(location.search);
	const categoryId = params.get("category") || null;
	const tag = params.get("tag") || null;
	const rawCursor = Number.parseInt(params.get("cursor") ?? "", 10);
	const cursor = Number.isFinite(rawCursor) ? rawCursor : null;
	const paged = cursor !== null;

	let page;
	let categories = [];
	let tags = [];
	try {
		const [posts, cats, tagList] = await Promise.all([
			bd.blog.listPosts({ limit: tag ? 50 : PAGE, cursor, categoryId }),
			bd.blog.listCategories().catch(() => ({ items: [] })),
			bd.blog.listTags().catch(() => ({ items: [] })),
		]);
		page = posts;
		categories = cats?.items ?? [];
		tags = tagList?.items ?? [];
	} catch (err) {
		root.replaceChildren(errBox(err));
		return;
	}
	const filtered = (page?.items ?? []).filter((post) => !tag || (post.tags ?? []).includes(tag));
	const posts = paged ? filtered : [...filtered].sort((a, b) => Number(b.isPinned) - Number(a.isPinned));
	const nextCursor = page?.nextCursor ?? null;
	const active = categories.find((c) => c.id === categoryId);
	if (active) document.title = `${active.name} — Blog`;

	/** This page with one filter changed and the paging reset. */
	function filterHref(key, value) {
		const next = new URLSearchParams();
		if (categoryId) next.set("category", categoryId);
		if (tag) next.set("tag", tag);
		if (value) next.set(key, value);
		else next.delete(key);
		const query = next.toString();
		return query ? `/blog?${query}` : "/blog";
	}

	function nextHref(next) {
		const query = new URLSearchParams();
		if (categoryId) query.set("category", categoryId);
		query.set("cursor", String(next));
		return `/blog?${query}`;
	}

	const filterLink = (current, href, label) =>
		el("li", {}, [el("a", { "aria-current": current ? "true" : null, href }, [label])]);

	root.replaceChildren(
		el("div", { class: "bd-section__lead" }, [
			el("span", { class: "bd-section__eyebrow" }, ["Blog"]),
			el("h1", { class: "bd-section__title" }, [active?.name ?? "From the blog"]),
			active?.description ? el("p", { class: "bd-section__sub" }, [active.description]) : null,
		]),
		categories.length > 0 || tags.length > 0
			? el("nav", { "aria-label": "Blog topics", class: "blog-filters" }, [
					categories.length > 0
						? el("ul", {}, [
								filterLink(!categoryId, filterHref("category", null), "All"),
								...categories.map((c) => filterLink(categoryId === c.id, filterHref("category", c.id), c.name)),
							])
						: null,
					tags.length > 0
						? el(
								"ul",
								{ class: "blog-filters__tags" },
								tags.map((t) => filterLink(tag === t, filterHref("tag", tag === t ? null : t), `#${t}`)),
							)
						: null,
				])
			: null,
		posts.length === 0
			? el("div", { class: "bd-empty" }, [
					tag || categoryId
						? "No posts here yet."
						: "No posts published yet. Write one in Business Dash and it'll appear here.",
				])
			: el(
					"ul",
					{ class: "posts" },
					posts.map((post, i) =>
						el("li", { class: `bd-card post-card${i === 0 && !paged ? " post-card--lead" : ""}` }, [
							el("a", { class: "post-card__link", href: `/blog/${encodeURIComponent(post.slug)}` }, [
								post.imageUrl
									? el("img", {
											alt: "",
											class: "post-card__img",
											loading: "lazy",
											referrerpolicy: "no-referrer",
											src: post.imageUrl,
										})
									: null,
								el("div", { class: "post-card__body" }, [
									el("p", { class: "post-card__meta" }, [
										post.isPinned ? el("span", { class: "bd-badge" }, ["Pinned"]) : null,
										el("span", {}, [formatPostDate(post.publishedAt)]),
										el("span", {}, [`· ${readingMinutes(post.content || post.excerpt || "")} min read`]),
									]),
									el("h2", {}, [post.title]),
									post.excerpt ? el("p", { class: "post-card__excerpt" }, [post.excerpt]) : null,
									post.authorName ? el("p", { class: "post-card__author" }, [post.authorName]) : null,
								]),
							]),
						]),
					),
				),
		nextCursor !== null && !tag && posts.length > 0
			? el("p", { class: "posts__more" }, [
					el("a", { class: "bd-btn bd-btn--ghost", href: nextHref(nextCursor) }, ["Older posts"]),
				])
			: null,
	);
}
