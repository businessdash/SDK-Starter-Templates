// [bd-file:store]
import { html, type Raw } from "../../html";

/**
 * The cart's coupon: a code box with Apply, or the applied code with
 * Remove. htmx posts it (/cart/coupon, /cart/coupon/remove) and swaps the
 * cart (#cart-region) back in.
 */
export function couponForm(couponCode: string | null | undefined): Raw {
	if (couponCode) {
		return html`<div class="coupon coupon--applied">
			<span>Coupon ${couponCode} applied</span>
			<button class="btn btn--ghost btn--sm" type="button" hx-post="/cart/coupon/remove" hx-target="#cart-region" hx-swap="outerHTML">Remove</button>
		</div>`;
	}
	return html`<form class="coupon" hx-post="/cart/coupon" hx-target="#cart-region" hx-swap="outerHTML">
		<input class="coupon__input" type="text" name="code" placeholder="Coupon code" aria-label="Coupon code" />
		<button class="btn btn--ghost btn--sm" type="submit">Apply</button>
	</form>`;
}
