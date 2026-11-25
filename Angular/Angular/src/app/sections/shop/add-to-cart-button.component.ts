// [bd-file:store]
import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import type { Price } from "../../shop/shop";

/** Add to cart; "Choose options" until every option is picked, Sold out when there's none. */
@Component({
	selector: "bd-add-to-cart-button",
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: ":host { display: contents; }",
	template: `
		<button class="bd-btn buy__add" data-bd-add type="button" [disabled]="!price().ready">{{
			price().amount === null ? "Sold out" : !price().ready ? "Choose options" : "Add to cart"
		}}</button>
	`,
})
export class AddToCartButtonComponent {
	readonly price = input.required<Price>();
}
