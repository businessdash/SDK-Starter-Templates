// [bd-file:store]
import { Form } from "react-router";
import { formatDollars } from "./shop";

/**
 * The subtotal, Clear cart and Checkout (intents "clear" and "checkout";
 * checkout goes on to Stripe's page).
 */
export function CartSummary({
	subtotal,
	currency,
}: {
	/** Dollars. */
	subtotal: number;
	currency: string;
}) {
	return (
		<>
			<div className="cart-total">
				<span>Subtotal</span>
				<strong>{formatDollars(subtotal, currency)}</strong>
			</div>

			<div className="cart-actions">
				<Form method="post">
					<input name="intent" type="hidden" value="clear" />
					<button className="link-btn" type="submit">
						Clear cart
					</button>
				</Form>
				<Form method="post">
					<input name="intent" type="hidden" value="checkout" />
					<button className="bd-btn" type="submit">
						Checkout
					</button>
				</Form>
			</div>
		</>
	);
}
