// [bd-file:blog]
import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { RouterLink } from "@angular/router";
import type { BlogPublicPost } from "@businessdash/sdk/contracts";
import { formatPostDate, readingMinutes } from "../../shop/blog";

/**
 * A post in the blog's list: cover, Pinned, date and reading time, title,
 * excerpt and author; `lead` draws it large. Use it on the list item:
 * `<li bd-post-card [post]="…">`.
 */
@Component({
	selector: "li[bd-post-card]",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [RouterLink],
	host: { class: "bd-card post-card", "[class.post-card--lead]": "lead()" },
	template: `
		@let p = post();
		<a class="post-card__link" [routerLink]="[blogHref(), p.slug]">
			@if (p.imageUrl) {
				<img alt="" class="post-card__img" loading="lazy" referrerpolicy="no-referrer" [src]="p.imageUrl" />
			}
			<div class="post-card__body">
				<p class="post-card__meta">
					@if (p.isPinned) {
						<span class="bd-badge">Pinned</span>
					}
					<span>{{ date() }}</span>
					<span>· {{ minutes() }} min read</span>
				</p>
				<h2>{{ p.title }}</h2>
				@if (p.excerpt) {
					<p class="post-card__excerpt">{{ p.excerpt }}</p>
				}
				@if (p.authorName) {
					<p class="post-card__author">{{ p.authorName }}</p>
				}
			</div>
		</a>
	`,
})
export class PostCardComponent {
	readonly post = input.required<BlogPublicPost>();
	readonly lead = input(false);
	readonly blogHref = input("/blog");

	readonly date = computed(() => formatPostDate(this.post().publishedAt));
	readonly minutes = computed(() => readingMinutes(this.post().content || this.post().excerpt || ""));
}
