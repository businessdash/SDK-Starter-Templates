// [bd-file:store]
import { ChangeDetectionStrategy, Component, effect, input, output } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import type { StoreSort } from "../../lib/bd-api.client";

/** The sorts, in the order they're offered. */
export const SORT_OPTIONS: ReadonlyArray<{ value: StoreSort; label: string }> = [
	{ value: "featured", label: "Featured" },
	{ value: "newest", label: "Newest" },
	{ value: "price-asc", label: "Price: low to high" },
	{ value: "price-desc", label: "Price: high to low" },
	{ value: "rating-desc", label: "Top rated" },
];

/** Featured, Newest, Price either way, Top rated. */
@Component({
	selector: "bd-sort-select",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ReactiveFormsModule],
	styles: ":host { display: contents; }",
	template: `
		<div class="store-sort">
			<label for="store-sort">Sort</label>
			<select class="bd-select" id="store-sort" [formControl]="control">
				@for (o of options; track o.value) {
					<option [value]="o.value">{{ o.label }}</option>
				}
			</select>
		</div>
	`,
})
export class SortSelectComponent {
	readonly value = input<StoreSort>("featured");
	readonly sortChange = output<StoreSort>();
	readonly options = SORT_OPTIONS;
	readonly control = new FormControl<StoreSort>("featured", { nonNullable: true });

	constructor() {
		effect(() => this.control.setValue(this.value(), { emitEvent: false }));
		this.control.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => this.sortChange.emit(value));
	}
}
