// [bd-file:blog]
import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { RouterLink } from "@angular/router";

/** The post's tags, each linking to the posts with it. */
@Component({
	selector: "bd-post-tags",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [RouterLink],
	styles: ":host { display: contents; }",
	template: `
		@if (tags().length > 0) {
			<ul class="post__tags">
				@for (t of tags(); track t) {
					<li>
						<a [queryParams]="{ tag: t }" [routerLink]="blogHref()">#{{ t }}</a>
					</li>
				}
			</ul>
		}
	`,
})
export class PostTagsComponent {
	readonly tags = input.required<string[]>();
	readonly blogHref = input("/blog");
}
