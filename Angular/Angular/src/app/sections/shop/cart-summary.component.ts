// [bd-file:store]
import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { cartMoney } from "./cart-money";

/** The subtotal (dollars). */
@Component({
	selector: "bd-cart-summary",
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: ":host { display: contents; }",
	template: `<p class="cart-total">Subtotal: <strong>{{ money(subtotal(), currency()) }}</strong></p>`,
})
export class CartSummaryComponent {
	readonly subtotal = input.required<number>();
	readonly currency = input.required<string>();
	readonly money = cartMoney;
}
