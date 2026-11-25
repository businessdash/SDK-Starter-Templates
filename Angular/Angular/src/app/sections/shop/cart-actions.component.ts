// [bd-file:store]
import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

/** Checkout ("Starting…" on the way to Stripe) and Clear cart. */
@Component({
	selector: "bd-cart-actions",
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: ":host { display: contents; }",
	template: `
		<div class="cart-actions">
			<button class="bd-btn" type="button" (click)="checkout.emit()" [disabled]="busy()">
				{{ busy() ? "Starting…" : "Checkout" }}
			</button>
			<button class="bd-btn bd-btn--ghost" type="button" (click)="clear.emit()">Clear cart</button>
		</div>
	`,
})
export class CartActionsComponent {
	readonly busy = input(false);
	readonly checkout = output();
	readonly clear = output();
}
