// [bd-file:blog]
import { For, Show } from "solid-js";

/**
 * The blog's topics: All and a link per category, then the tags. Each link
 * changes one filter and starts the list over. They're plain links, not
 * <Link>: <Link> sets aria-current itself, to "page" whenever its search
 * partly matches, so "All" would count as current on every topic.
 */
export function BlogFilters(props: {
	categories: Array<{ id: string; name: string }>;
	tags: string[];
	category: string | undefined;
	tag: string | undefined;
}) {
	const href = (key: "category" | "tag", value: string | undefined) => {
		const next = { category: props.category, tag: props.tag, [key]: value };
		const query = new URLSearchParams();
		if (next.category) query.set("category", next.category);
		if (next.tag) query.set("tag", next.tag);
		const qs = query.toString();
		return qs ? `/blog?${qs}` : "/blog";
	};
	return (
		<Show when={props.categories.length > 0 || props.tags.length > 0}>
			<nav aria-label="Blog topics" class="blog-filters">
				<Show when={props.categories.length > 0}>
					<ul>
						<li>
							<a
								aria-current={props.category ? undefined : "true"}
								href={href("category", undefined)}
							>
								All
							</a>
						</li>
						<For each={props.categories}>
							{(category) => (
								<li>
									<a
										aria-current={
											props.category === category.id ? "true" : undefined
										}
										href={href("category", category.id)}
									>
										{category.name}
									</a>
								</li>
							)}
						</For>
					</ul>
				</Show>
				<Show when={props.tags.length > 0}>
					<ul class="blog-filters__tags">
						<For each={props.tags}>
							{(t) => (
								<li>
									<a
										aria-current={props.tag === t ? "true" : undefined}
										href={href("tag", props.tag === t ? undefined : t)}
									>
										#{t}
									</a>
								</li>
							)}
						</For>
					</ul>
				</Show>
			</nav>
		</Show>
	);
}
