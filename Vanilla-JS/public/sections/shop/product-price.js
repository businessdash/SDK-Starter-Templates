// [bd-file:store]
import { el } from "/bd.js";
import { formatDollars } from "/shop/shop.js";

/**
 * The price for what's chosen times the quantity: "From" until every option
 * is picked, the price each when buying more than one, Sold out when there's
 * none. `price` is from priceFor(); `<bd-product-form>` keeps it in step
 * (data-bd-*).
 */
export function productPrice(price, quantity = 1) {
	const amount = price.amount;
	const each = amount != null && quantity > 1;
	return el("p", { class: "product-detail__price", "data-bd-price": true }, [
		el("span", { class: "product-detail__from", "data-bd-from": true, hidden: !(amount != null && price.from) }, [
			"From",
		]),
		" ",
		el("span", { "data-bd-amount": true }, [amount != null ? formatDollars(amount * quantity) : "Sold out"]),
		el("span", { class: "product-detail__each", "data-bd-each": true, hidden: !each }, [
			each ? ` (${formatDollars(amount)} each)` : "",
		]),
	]);
}
