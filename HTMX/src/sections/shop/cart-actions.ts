// [bd-file:store]
import { html, type Raw } from "../../html";

/** Clear cart (htmx posts /cart/clear) and Checkout (a form posting /cart/checkout, on to Stripe). */
export function cartActions(): Raw {
	return html`<div class="cart-actions">
		<button class="btn btn--ghost" type="button" hx-post="/cart/clear" hx-target="#cart-region" hx-swap="outerHTML">Clear cart</button>
		<form method="post" action="/cart/checkout"><button class="btn btn--primary btn--lg" type="submit">Checkout</button></form>
	</div>`;
}
