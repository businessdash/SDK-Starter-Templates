// [bd-file:store]
import { html, type Raw } from "../../html";
import type { Price } from "../../shop/shop";

/** Add to cart; "Choose options" until every option is picked, Sold out when there's none. */
export function addToCartButton(price: Price): Raw {
	return html`<button class="bd-btn buy__add" data-bd-add${price.ready ? "" : html` disabled`} type="button">${
		price.amount === null ? "Sold out" : !price.ready ? "Choose options" : "Add to cart"
	}</button>`;
}
