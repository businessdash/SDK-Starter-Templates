// [bd-file:blog]
import { html, type Raw } from "../../html";

/**
 * The blog's topics: All and a link per category, then a link per tag
 * (pressing the chosen tag again drops it). They're links (?category,
 * ?tag), so a filtered list can be shared; choosing one starts from the
 * first page.
 */
export function blogFilters(opts: {
	categories: { id: string; name: string }[];
	tags: string[];
	category?: string | null;
	tag?: string | null;
	blogHref?: string;
}): Raw {
	const { categories, tags, category = null, tag = null, blogHref = "/blog" } = opts;
	if (categories.length === 0 && tags.length === 0) return html``;

	/** This list with one filter changed and the paging reset. */
	const filterHref = (key: "category" | "tag", value: string | null): string => {
		const next = new URLSearchParams();
		if (category) next.set("category", category);
		if (tag) next.set("tag", tag);
		if (value) next.set(key, value);
		else next.delete(key);
		const query = next.toString();
		return query ? `${blogHref}?${query}` : blogHref;
	};

	return html`<nav aria-label="Blog topics" class="blog-filters">
		${
			categories.length > 0
				? html`<ul>
					<li><a${!category ? html` aria-current="true"` : ""} href="${filterHref("category", null)}">All</a></li>
					${categories.map(
						(c) =>
							html`<li><a${category === c.id ? html` aria-current="true"` : ""} href="${filterHref("category", c.id)}">${c.name}</a></li>`,
					)}
				</ul>`
				: ""
		}
		${
			tags.length > 0
				? html`<ul class="blog-filters__tags">
					${tags.map(
						(t) => html`<li><a${tag === t ? html` aria-current="true"` : ""} href="${filterHref("tag", tag === t ? null : t)}">#${t}</a></li>`,
					)}
				</ul>`
				: ""
		}
	</nav>`;
}
