// [bd-file:blog]
import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { formatPostDate } from "../../shop/blog";

/** The author (photo and name), the date and the reading time. */
@Component({
	selector: "bd-post-meta",
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: ":host { display: contents; }",
	template: `
		<p class="post__meta">
			@if (authorAvatarUrl()) {
				<img alt="" referrerpolicy="no-referrer" [src]="authorAvatarUrl()" />
			}
			@if (authorName()) {
				<span>{{ authorName() }}</span>
			}
			<span>{{ date() }}</span>
			<span>· {{ minutes() }} min read</span>
		</p>
	`,
})
export class PostMetaComponent {
	readonly authorName = input<string | null>(null);
	readonly authorAvatarUrl = input<string | null>(null);
	readonly publishedAt = input<string | null>(null);
	readonly minutes = input.required<number>();

	readonly date = computed(() => formatPostDate(this.publishedAt()));
}
