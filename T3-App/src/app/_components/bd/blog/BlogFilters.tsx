// [bd-file:blog]
import type { BlogCategory } from "@businessdash/sdk/contracts";
import { BdLink } from "../bd-link";

/**
 * The blog's topics: a link per category and per tag. Each link keeps the
 * other filter and starts the list from the first page.
 */
export function BlogFilters({
	categories,
	tags,
	categoryId,
	tag,
}: {
	categories: BlogCategory[];
	tags: string[];
	categoryId: string | null;
	tag: string | null;
}) {
	if (categories.length === 0 && tags.length === 0) return null;

	/** This page with one filter changed and the paging reset. */
	function filterHref(key: "category" | "tag", value: string | null): string {
		const params = new URLSearchParams();
		if (categoryId) params.set("category", categoryId);
		if (tag) params.set("tag", tag);
		if (value) params.set(key, value);
		else params.delete(key);
		const query = params.toString();
		return query ? `/blog?${query}` : "/blog";
	}

	return (
		<nav aria-label="Blog topics" className="blog-filters">
			{categories.length > 0 && (
				<ul>
					<li>
						<BdLink
							aria-current={!categoryId}
							href={filterHref("category", null)}
						>
							All
						</BdLink>
					</li>
					{categories.map((category) => (
						<li key={category.id}>
							<BdLink
								aria-current={categoryId === category.id}
								href={filterHref("category", category.id)}
							>
								{category.name}
							</BdLink>
						</li>
					))}
				</ul>
			)}
			{tags.length > 0 && (
				<ul className="blog-filters__tags">
					{tags.map((t) => (
						<li key={t}>
							<BdLink
								aria-current={tag === t}
								href={filterHref("tag", tag === t ? null : t)}
							>
								#{t}
							</BdLink>
						</li>
					))}
				</ul>
			)}
		</nav>
	);
}
