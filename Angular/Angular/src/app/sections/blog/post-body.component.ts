// [bd-file:blog]
import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/**
 * The post's text. The HTML comes from the server already rebuilt from an
 * allowlist (`safePostHtml`, src/app/shop/blog.ts); Angular's sanitizer
 * checks it again.
 */
@Component({
	selector: "bd-post-body",
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: ":host { display: contents; }",
	template: `<div class="post__body" [innerHTML]="html()"></div>`,
})
export class PostBodyComponent {
	readonly html = input.required<string>();
}
