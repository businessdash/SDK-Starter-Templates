// [bd-file:store]
import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { formatDollars, type ProductVariant } from "../../shop/shop";

/**
 * A button per variant (Cloud, Storm…), the chosen one pressed; sold-out
 * ones can't be pressed. Nothing shows for a product with one variant. A
 * variant's price shows on its button while it has no options of its own.
 */
@Component({
	selector: "bd-variant-picker",
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: ":host { display: contents; }",
	template: `
		@if (variants().length > 1) {
			<fieldset class="choice">
				<legend class="bd-label">Option</legend>
				<div class="choice__values">
					@for (v of variants(); track v.id) {
						<button
							class="choice__value"
							type="button"
							[attr.aria-pressed]="v.id === selected() ? 'true' : 'false'"
							[attr.data-bd-variant]="v.id"
							[class.choice__value--on]="v.id === selected()"
							[disabled]="!v.available"
						>{{ v.name
							}}@if (v.price != null) {<small data-bd-variant-price [hidden]="!showPrices()">{{
									" " + money(v.price)
								}}</small>}</button>
					}
				</div>
			</fieldset>
		}
	`,
})
export class VariantPickerComponent {
	readonly variants = input.required<ProductVariant[]>();
	readonly selected = input.required<string>();
	readonly showPrices = input.required<boolean>();
	readonly money = formatDollars;
}
