// [bd-file:blog]
import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, computed, input } from "@angular/core";
import type { BlogPublicComment } from "@businessdash/sdk/contracts";

/**
 * The comments and the box to add one. Commenting is for signed-in
 * customers: `<bd-post-comments>` (src/app/shop/blog-elements.ts, which the
 * post page loads) posts to the post's /comment; signed out, it leads to
 * sign-in and back.
 */
@Component({
	selector: "bd-comments",
	changeDetection: ChangeDetectionStrategy.OnPush,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	styles: ":host { display: contents; }",
	template: `
		<bd-post-comments [attr.data-comment-url]="commentUrl()" [attr.data-sign-in-href]="signInHref()" [data]="data()" />
	`,
})
export class CommentsComponent {
	readonly comments = input.required<BlogPublicComment[]>();
	readonly signedIn = input.required<boolean>();
	readonly commentUrl = input.required<string>();
	readonly signInHref = input.required<string>();

	readonly data = computed(() => ({ comments: this.comments(), signedIn: this.signedIn() }));
}
