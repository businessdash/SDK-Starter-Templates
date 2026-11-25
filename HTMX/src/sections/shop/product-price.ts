// [bd-file:store]
import { html, type Raw } from "../../html";
import { formatDollars, type Price } from "../../shop/shop";

/**
 * The price for what's chosen times the quantity: "From" until every option
 * is picked, the price each when buying more than one, Sold out when there's
 * none. `price` is from priceFor(); `<bd-product-form>` keeps it in step
 * (data-bd-*).
 */
export function productPrice(price: Price, quantity = 1): Raw {
	const amount = price.amount;
	const from = amount != null && price.from;
	const each = amount != null && quantity > 1;
	return html`<p class="product-detail__price" data-bd-price><span class="product-detail__from" data-bd-from${from ? "" : html` hidden`}>From</span> <span data-bd-amount>${amount != null ? formatDollars(amount * quantity) : "Sold out"}</span><span class="product-detail__each" data-bd-each${each ? "" : html` hidden`}>${each && amount != null ? ` (${formatDollars(amount)} each)` : ""}</span></p>`;
}
