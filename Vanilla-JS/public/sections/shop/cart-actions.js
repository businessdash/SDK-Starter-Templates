// [bd-file:store]
import { el } from "/bd.js";

/**
 * Clear cart and Checkout, with a line for how checkout is going.
 * `onCheckout()` resolves to the Stripe URL to go to; `onClear()` empties
 * the cart. Returns the nodes, to append in order.
 */
export function cartActions({ onCheckout, onClear }) {
	const status = el("p", { class: "cart-checkout__status" }, []);
	const checkout = el(
		"button",
		{
			class: "btn btn--primary btn--lg",
			type: "button",
			onClick: async () => {
				checkout.disabled = true;
				status.textContent = "Starting checkout…";
				try {
					location.href = await onCheckout();
				} catch (err) {
					status.textContent = `Couldn't start checkout: ${err?.message ?? err}`;
					checkout.disabled = false;
				}
			},
		},
		["Checkout"],
	);
	return [
		el("div", { class: "cart-actions" }, [
			el("button", { class: "btn btn--ghost", type: "button", onClick: () => onClear() }, ["Clear cart"]),
			checkout,
		]),
		status,
	];
}
