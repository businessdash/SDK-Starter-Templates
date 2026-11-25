// [bd-file:store]
import { dollars } from "../../lib/bd";

/** The subtotal and how many items it's for. */
export function CartSummary({
	itemCount,
	subtotal,
	currency,
}: {
	itemCount: number | undefined;
	subtotal: number | undefined;
	currency: string;
}) {
	return (
		<div className="cart-summary">
			<div className="cart-summary__row">
				<span>
					Subtotal ({itemCount} item{itemCount === 1 ? "" : "s"})
				</span>
				<strong>{dollars(subtotal, currency)}</strong>
			</div>
		</div>
	);
}
