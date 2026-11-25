// [bd-file:blog]
import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/** The post's call to action, when it has one: a line and a button. */
@Component({
	selector: "bd-post-cta",
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: ":host { display: contents; }",
	template: `
		@if (href() && label()) {
			<aside class="bd-card post__cta">
				@if (description()) {
					<p>{{ description() }}</p>
				}
				<a class="bd-btn" [href]="href()">{{ label() }}</a>
			</aside>
		}
	`,
})
export class PostCtaComponent {
	readonly label = input<string | null>(null);
	readonly href = input<string | null>(null);
	readonly description = input<string | null>(null);
}
