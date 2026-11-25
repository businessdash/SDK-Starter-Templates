// [bd-file:store]
import { ChangeDetectionStrategy, Component, effect, input, output } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";

/** Lowest and highest price (dollars, as typed), with Apply. `range` is what the store's products cost. */
@Component({
	selector: "bd-price-filter",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ReactiveFormsModule],
	styles: ":host { display: contents; }",
	template: `
		<form class="store-facet" [formGroup]="form" (ngSubmit)="apply.emit(form.getRawValue())">
			<p class="store-facet__title">Price</p>
			<div class="store-price">
				<input
					aria-label="Lowest price"
					class="bd-input"
					formControlName="min"
					inputmode="decimal"
					[placeholder]="range() ? '$' + floor(range()!.minDollars) : 'Min'"
				/>
				<span aria-hidden="true" class="store-price__sep">–</span>
				<input
					aria-label="Highest price"
					class="bd-input"
					formControlName="max"
					inputmode="decimal"
					[placeholder]="range() ? '$' + ceil(range()!.maxDollars) : 'Max'"
				/>
			</div>
			<button class="bd-btn bd-btn--ghost store-price__apply" type="submit">Apply</button>
		</form>
	`,
})
export class PriceFilterComponent {
	/** The prices as typed; a new value (even the same text) resets the boxes. */
	readonly value = input<{ min: string; max: string }>({ min: "", max: "" });
	readonly range = input<{ minDollars: number; maxDollars: number } | null>(null);
	readonly apply = output<{ min: string; max: string }>();
	readonly floor = Math.floor;
	readonly ceil = Math.ceil;

	readonly form = new FormGroup({
		min: new FormControl("", { nonNullable: true }),
		max: new FormControl("", { nonNullable: true }),
	});

	constructor() {
		effect(() => this.form.setValue(this.value(), { emitEvent: false }));
	}
}
