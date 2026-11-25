// [bd-file:store]
import { ChangeDetectionStrategy, Component, output } from "@angular/core";

/** Clear all filters. */
@Component({
	selector: "bd-clear-filters",
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: ":host { display: contents; }",
	template: `<button class="store-clear" type="button" (click)="clear.emit()">Clear all filters</button>`,
})
export class ClearFiltersComponent {
	readonly clear = output();
}
