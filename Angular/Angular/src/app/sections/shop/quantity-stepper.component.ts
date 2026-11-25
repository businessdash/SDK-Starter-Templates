// [bd-file:store]
import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/** − and + around how many to add, from 1 up to what's in stock. */
@Component({
	selector: "bd-quantity-stepper",
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: ":host { display: contents; }",
	template: `
		<div aria-label="Quantity" class="qty" role="group">
			<button aria-label="One fewer" data-bd-qty="-1" type="button" [disabled]="quantity() <= 1">−</button>
			<span aria-live="polite" data-bd-qty-value>{{ quantity() }}</span>
			<button aria-label="One more" data-bd-qty="1" type="button" [disabled]="max() != null && quantity() >= max()!">
				+
			</button>
		</div>
	`,
})
export class QuantityStepperComponent {
	readonly quantity = input(1);
	readonly max = input.required<number | null>();
}
