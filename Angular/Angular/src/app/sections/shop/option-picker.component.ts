// [bd-file:store]
import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import type { OptionGroup } from "../../shop/shop";

/**
 * One option group (Size, Colour…): a button per value, the chosen value's
 * name beside the title. A group that belongs to one variant shows only
 * while that variant is chosen.
 */
@Component({
	selector: "bd-option-picker",
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: ":host { display: contents; }",
	template: `
		<fieldset
			class="choice"
			[attr.data-bd-for-variant]="group().variantId"
			[attr.data-bd-group]="group().id"
			[hidden]="hidden()"
		>
			<legend class="bd-label">{{ group().title }}<span class="choice__picked" data-bd-picked hidden></span></legend>
			<div class="choice__values">
				@for (value of group().values; track value.id) {
					<button
						aria-pressed="false"
						class="choice__value"
						type="button"
						[attr.data-bd-value]="value.id"
						[attr.title]="value.available ? null : 'Sold out'"
						[disabled]="!value.available"
					>{{ value.value }}</button>
				}
			</div>
		</fieldset>
	`,
})
export class OptionPickerComponent {
	readonly group = input.required<OptionGroup & { variantId: string | null }>();
	readonly hidden = input(false);
}
