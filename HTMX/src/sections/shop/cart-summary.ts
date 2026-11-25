// [bd-file:store]
import { html, type Raw } from "../../html";
import { dollars } from "../../layout";

/** The subtotal and how many items (cart amounts are dollars). */
export function cartSummary(cart: { itemCount: number; subtotal: number }, currency: string): Raw {
	return html`<div class="cart-summary">
		<div class="cart-summary__row">
			<span>Subtotal (${String(cart.itemCount)} item${cart.itemCount === 1 ? "" : "s"})</span>
			<strong>${dollars(cart.subtotal, currency)}</strong>
		</div>
	</div>`;
}
