// [bd-file:blog]
import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, computed, input } from "@angular/core";
import type { BlogLikeResponse } from "@businessdash/sdk/contracts";

/**
 * ♥ Like and the count. Likes are for signed-in customers: `<bd-post-like>`
 * (src/app/shop/blog-elements.ts, which the post page loads) posts to the
 * post's /like; signed out, it leads to sign-in and back.
 */
@Component({
	selector: "bd-like-button",
	changeDetection: ChangeDetectionStrategy.OnPush,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	styles: ":host { display: contents; }",
	template: `<bd-post-like [attr.data-like-url]="likeUrl()" [attr.data-sign-in-href]="signInHref()" [data]="data()" />`,
})
export class LikeButtonComponent {
	readonly likes = input.required<BlogLikeResponse>();
	readonly signedIn = input.required<boolean>();
	readonly likeUrl = input.required<string>();
	readonly signInHref = input.required<string>();

	readonly data = computed(() => ({ likes: this.likes(), signedIn: this.signedIn() }));
}
