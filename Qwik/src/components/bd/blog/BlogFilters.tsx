// [bd-file:blog]
import { Link } from "@builder.io/qwik-city";

/** The list's link with one filter changed (the other kept). */
function filterHref(current: { category: string; tag: string }, key: "category" | "tag", value: string | null): string {
	const params = new URLSearchParams();
	if (current.category) params.set("category", current.category);
	if (current.tag) params.set("tag", current.tag);
	if (value) params.set(key, value);
	else params.delete(key);
	const qs = params.toString();
	return qs ? `/blog?${qs}` : "/blog";
}

/** All and a link per category, then the tags; the chosen ones marked. */
export function BlogFilters({
	categories,
	tags,
	category,
	tag,
}: {
	categories: Array<{ id: string; name: string }>;
	tags: string[];
	/** The chosen category's id, or "". */
	category: string;
	/** The chosen tag, or "". */
	tag: string;
}) {
	if (categories.length === 0 && tags.length === 0) return null;
	const current = { category, tag };
	return (
		<nav aria-label="Blog topics" class="blog-filters">
			{categories.length > 0 ? (
				<ul>
					<li>
						<Link aria-current={category ? undefined : "true"} href={filterHref(current, "category", null)}>
							All
						</Link>
					</li>
					{categories.map((c) => (
						<li key={c.id}>
							<Link aria-current={category === c.id ? "true" : undefined} href={filterHref(current, "category", c.id)}>
								{c.name}
							</Link>
						</li>
					))}
				</ul>
			) : null}
			{tags.length > 0 ? (
				<ul class="blog-filters__tags">
					{tags.map((t) => (
						<li key={t}>
							<Link aria-current={tag === t ? "true" : undefined} href={filterHref(current, "tag", tag === t ? null : t)}>
								#{t}
							</Link>
						</li>
					))}
				</ul>
			) : null}
		</nav>
	);
}
