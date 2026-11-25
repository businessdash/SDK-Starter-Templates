// [bd-file:store]
import { formatDollars, type Price } from "../../../lib/shop/shop";

/**
 * The price for what's chosen times the quantity: "From" until every option
 * is picked, the price each when buying more than one, Sold out when there's
 * none. `<bd-product-form>` keeps it in step (data-bd-*).
 */
export function ProductPrice(props: { price: Price; quantity?: number }) {
	const quantity = () => props.quantity ?? 1;
	const amount = () => props.price.amount;
	return (
		<p class="product-detail__price" data-bd-price>
			<span
				class="product-detail__from"
				data-bd-from
				hidden={!(amount() != null && props.price.from)}
			>
				From
			</span>{" "}
			<span data-bd-amount>
				{amount() != null
					? formatDollars((amount() ?? 0) * quantity())
					: "Sold out"}
			</span>
			<span
				class="product-detail__each"
				data-bd-each
				hidden={!(amount() != null && quantity() > 1)}
			>
				{amount() != null && quantity() > 1
					? ` (${formatDollars(amount() ?? 0)} each)`
					: ""}
			</span>
		</p>
	);
}
