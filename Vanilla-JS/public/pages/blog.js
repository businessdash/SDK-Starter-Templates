// [bd-file:blog]
/**
 * /blog — posts newest first (pinned ones lead the first page), with
 * category and tag filters and "Older posts" paging, all links in the URL
 * (?category, ?tag, ?cursor). The page is laid out from the blog's parts
 * (/sections/blog/): the filters and a post card per post.
 */
import { bd, el } from "/bd.js";
import { blogFilters } from "/sections/blog/blog-filters.js";
import { postCard } from "/sections/blog/post-card.js";
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

	function nextHref(next) {
		const query = new URLSearchParams();
		if (categoryId) query.set("category", categoryId);
		query.set("cursor", String(next));
		return `/blog?${query}`;
	}

	root.replaceChildren(
		el("div", { class: "bd-section__lead" }, [
			el("span", { class: "bd-section__eyebrow" }, ["Blog"]),
			el("h1", { class: "bd-section__title" }, [active?.name ?? "From the blog"]),
			active?.description ? el("p", { class: "bd-section__sub" }, [active.description]) : null,
		]),
		blogFilters({ categories, tags, category: categoryId, tag }),
		posts.length === 0
			? el("div", { class: "bd-empty" }, [
					tag || categoryId
						? "No posts here yet."
						: "No posts published yet. Write one in Business Dash and it'll appear here.",
				])
			: el(
					"ul",
					{ class: "posts" },
					posts.map((post, i) => postCard(post, { lead: i === 0 && !paged })),
				),
		nextCursor !== null && !tag && posts.length > 0
			? el("p", { class: "posts__more" }, [
					el("a", { class: "bd-btn bd-btn--ghost", href: nextHref(nextCursor) }, ["Older posts"]),
				])
			: null,
	);
}
