// [bd-file:blog]
import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/** In place of a members' post: Sign in to read it. */
@Component({
	selector: "bd-members-only",
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: ":host { display: contents; }",
	template: `
		<div class="bd-empty">
			This post is for members.
			<p><a class="bd-btn" [href]="signInHref()">Sign in to read it</a></p>
		</div>
	`,
})
export class MembersOnlyComponent {
	readonly signInHref = input.required<string>();
}
