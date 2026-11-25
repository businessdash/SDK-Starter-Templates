// [bd-file:store]
import { html, type Raw } from "../../html";

/** After adding: "Added 2 to your cart." with View cart, or what went wrong. */
export function cartNotice(cartHref: string): Raw {
	return html`<div class="product-detail__msg" data-bd-notice hidden role="status"><span data-bd-notice-text></span><a class="bd-btn bd-btn--ghost" data-bd-notice-link href="${cartHref}">View cart</a></div>`;
}
