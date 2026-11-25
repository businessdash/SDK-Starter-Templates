// [bd-file:store]
import { usd } from "./store-utils";

/** The subtotal and how many items it's for. */
export function CartSummary({
	itemCount,
	subtotal,
	currency,
}: {
	itemCount: number;
	/** Dollars. */
	subtotal: number;
	currency: string;
}) {
	return (
		<div className="cart__total">
			<span>
				Subtotal ({itemCount} item
				{itemCount === 1 ? "" : "s"})
			</span>
			<span className="cart__totalAmount">{usd(subtotal, currency)}</span>
		</div>
	);
}
