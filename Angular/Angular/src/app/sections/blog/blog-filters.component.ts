// [bd-file:blog]
import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { RouterLink } from "@angular/router";
import type { BlogCategory } from "@businessdash/sdk/contracts";

/** Query params for a list link; empty filters stay out of the URL. */
export function blogQuery(filters: {
	category?: string | null;
	tag?: string | null;
	cursor?: number | null;
}): Record<string, string> {
	const out: Record<string, string> = {};
	if (filters.category) out["category"] = filters.category;
	if (filters.tag) out["tag"] = filters.tag;
	if (filters.cursor != null) out["cursor"] = String(filters.cursor);
	return out;
}

/**
 * The blog's topics: All and a link per category, then a link per tag
 * (pressing the chosen tag again drops it). They're links (?category,
 * ?tag), so a filtered list can be shared.
 */
@Component({
	selector: "bd-blog-filters",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [RouterLink],
	styles: ":host { display: contents; }",
	template: `
		@if (categoryLinks().length > 0 || tagLinks().length > 0) {
			<nav aria-label="Blog topics" class="blog-filters">
				@if (categoryLinks().length > 0) {
					<ul>
						@for (link of categoryLinks(); track link.label) {
							<li>
								<a [attr.aria-current]="link.current ? 'true' : null" [queryParams]="link.params" [routerLink]="blogHref()">{{
									link.label
								}}</a>
							</li>
						}
					</ul>
				}
				@if (tagLinks().length > 0) {
					<ul class="blog-filters__tags">
						@for (link of tagLinks(); track link.label) {
							<li>
								<a [attr.aria-current]="link.current ? 'true' : null" [queryParams]="link.params" [routerLink]="blogHref()">{{
									link.label
								}}</a>
							</li>
						}
					</ul>
				}
			</nav>
		}
	`,
})
export class BlogFiltersComponent {
	readonly categories = input.required<BlogCategory[]>();
	readonly tags = input.required<string[]>();
	readonly category = input<string | null>(null);
	readonly tag = input<string | null>(null);
	readonly blogHref = input("/blog");

	readonly categoryLinks = computed(() => {
		const category = this.category();
		const tag = this.tag();
		const cats = this.categories();
		if (cats.length === 0) return [];
		return [
			{ label: "All", params: blogQuery({ tag }), current: !category },
			...cats.map((c) => ({ label: c.name, params: blogQuery({ category: c.id, tag }), current: category === c.id })),
		];
	});

	readonly tagLinks = computed(() => {
		const category = this.category();
		const tag = this.tag();
		return this.tags().map((t) => ({
			label: `#${t}`,
			params: blogQuery({ category, tag: tag === t ? null : t }),
			current: tag === t,
		}));
	});
}
