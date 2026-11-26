// [bd-file:store]
import { formatDollars, type Price } from "../../../lib/shop/shop";

/**
 * The price for what's chosen times the quantity: "From" until every option
 * is picked, the price each when buying more than one, Sold out when there's
 * none. `<bd-product-form>` keeps it in step (data-bd-*).
 */
export function ProductPrice({
	price,
	quantity = 1,
}: {
	price: Price;
	quantity?: number;
}) {
	const { amount } = price;
	return (
		<p class="product-detail__price" data-bd-price="">
			<span
				class="product-detail__from"
				data-bd-from=""
				hidden={!(amount != null && price.from)}
			>
				From
			</span>{" "}
			<span data-bd-amount="">
				{amount != null ? formatDollars(amount * quantity) : "Sold out"}
			</span>
			<span
				class="product-detail__each"
				data-bd-each=""
				hidden={!(amount != null && quantity > 1)}
			>
				{amount != null && quantity > 1
					? ` (${formatDollars(amount)} each)`
					: ""}
			</span>
		</p>
	);
}
