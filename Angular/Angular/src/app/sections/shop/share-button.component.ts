// [bd-file:store]
import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, input } from "@angular/core";

/** ↗ Share: the share sheet, or the link copied ("Link copied"), by `<bd-share>`. */
@Component({
	selector: "bd-share-button",
	changeDetection: ChangeDetectionStrategy.OnPush,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	styles: ":host { display: contents; }",
	template: `
		<bd-share [attr.data-title]="title()">
			<button class="share" data-bd-share type="button"><span aria-hidden="true">↗</span> Share</button>
			<span class="share__note" data-bd-share-note hidden role="status"></span>
		</bd-share>
	`,
})
export class ShareButtonComponent {
	readonly title = input.required<string>();
}
