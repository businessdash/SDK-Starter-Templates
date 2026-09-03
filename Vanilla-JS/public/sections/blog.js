import { bd, el, empty, loading } from "../bd.js";

function formatDate(iso) {
	if (!iso) return "";
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

/** @param {HTMLElement} target */
export async function renderBlog(target) {
	target.replaceChildren(
		el("div", { class: "bd-section__lead" }, [
			el("span", { class: "bd-section__eyebrow" }, ["Latest"]),
			el("h2", { class: "bd-section__title" }, ["From the blog"]),
			el("p", { class: "bd-section__sub" }, [
				"Tips, customer stories, and what we're working on this month.",
			]),
		]),
		loading("Loading posts…"),
	);

	let posts = [];
	try {
		const result = await bd.blog.listPosts({ limit: 6 });
		posts = result?.items ?? [];
	} catch {
		posts = [];
	}

	const lead = target.firstChild;
	target.replaceChildren(lead);

	if (posts.length === 0) {
		target.append(
			empty(
				"No blog posts published yet. Add one in BD and it'll appear here.",
			),
		);
		return;
	}

	target.append(
		el(
			"div",
			{ class: "bd-grid-3" },
			posts.map((post) =>
				el(
					"a",
					{ class: "bd-card blog-card", href: `/blog/${post.slug}` },
					[
						el("span", { class: "blog-card__meta" }, [
							formatDate(post.publishedAt),
						]),
						el("h3", {}, [post.title]),
						post.excerpt ? el("p", {}, [post.excerpt]) : null,
					],
				),
			),
		),
	);
}
