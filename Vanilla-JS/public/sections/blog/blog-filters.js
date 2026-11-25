// [bd-file:blog]
import { el } from "/bd.js";

/**
 * The blog's topics: All and a link per category, then a link per tag
 * (pressing the chosen tag again drops it). They're links (?category,
 * ?tag), so a filtered list can be shared; choosing one starts from the
 * first page.
 */
export function blogFilters({ categories, tags, category = null, tag = null, blogHref = "/blog" }) {
	if (categories.length === 0 && tags.length === 0) return null;

	/** This list with one filter changed and the paging reset. */
	function filterHref(key, value) {
		const next = new URLSearchParams();
		if (category) next.set("category", category);
		if (tag) next.set("tag", tag);
		if (value) next.set(key, value);
		else next.delete(key);
		const query = next.toString();
		return query ? `${blogHref}?${query}` : blogHref;
	}
	const link = (current, href, label) =>
		el("li", {}, [el("a", { "aria-current": current ? "true" : null, href }, [label])]);

	return el("nav", { "aria-label": "Blog topics", class: "blog-filters" }, [
		categories.length > 0
			? el("ul", {}, [
					link(!category, filterHref("category", null), "All"),
					...categories.map((c) => link(category === c.id, filterHref("category", c.id), c.name)),
				])
			: null,
		tags.length > 0
			? el(
					"ul",
					{ class: "blog-filters__tags" },
					tags.map((t) => link(tag === t, filterHref("tag", tag === t ? null : t), `#${t}`)),
				)
			: null,
	]);
}
