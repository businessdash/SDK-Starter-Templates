// [bd-file:store]
import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { formatDollars, type Price } from "../../shop/shop";

/**
 * The price for what's chosen times the quantity: "From" until every option
 * is picked, the price each when buying more than one, Sold out when there's
 * none. `<bd-product-form>` keeps it in step (data-bd-*).
 */
@Component({
	selector: "bd-product-price",
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: ":host { display: contents; }",
	template: `
		<p class="product-detail__price" data-bd-price>
			<span class="product-detail__from" data-bd-from [hidden]="!showFrom()">From</span>{{ " "
			}}<span data-bd-amount>{{ amount() }}</span
			><span class="product-detail__each" data-bd-each [hidden]="!each()">{{ each() }}</span>
		</p>
	`,
})
export class ProductPriceComponent {
	readonly price = input.required<Price>();
	readonly quantity = input(1);

	readonly showFrom = computed(() => this.price().amount != null && this.price().from);
	readonly amount = computed(() => {
		const amount = this.price().amount;
		return amount != null ? formatDollars(amount * this.quantity()) : "Sold out";
	});
	readonly each = computed(() => {
		const amount = this.price().amount;
		return amount != null && this.quantity() > 1 ? ` (${formatDollars(amount)} each)` : "";
	});
}
