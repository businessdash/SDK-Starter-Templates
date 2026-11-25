// [bd-file:store]
import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import type { CartItem } from "../../lib/bd-api.client";
import { cartMoney } from "./cart-money";

/**
 * One line of the cart: name and option, − and + around the quantity, the
 * line's total, and Remove. Use it on the list item: `<li bd-cart-line …>`.
 */
@Component({
	selector: "li[bd-cart-line]",
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: "cart-row" },
	template: `
		<span class="cart-row__name">
			{{ item().productName || "Item" }}
			@if (item().variantTitle) {
				<span class="cart-row__variant">{{ item().variantTitle }}</span>
			}
		</span>
		<span class="cart-row__qty">
			<button type="button" (click)="quantity.emit(item().quantity - 1)" aria-label="Decrease">−</button>
			{{ item().quantity }}
			<button type="button" (click)="quantity.emit(item().quantity + 1)" aria-label="Increase">+</button>
		</span>
		<span class="cart-row__price">{{ money(item().subtotal, currency()) }}</span>
		<button class="cart-row__remove" type="button" (click)="remove.emit()">Remove</button>
	`,
})
export class CartLineComponent {
	readonly item = input.required<CartItem>();
	readonly currency = input.required<string>();
	/** The quantity asked for (0 removes the line). */
	readonly quantity = output<number>();
	readonly remove = output();
	readonly money = cartMoney;
}
