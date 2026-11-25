// [bd-file:store]
import { el } from "/bd.js";

/** Add to cart; "Choose options" until every option is picked, Sold out when there's none. */
export function addToCartButton(price) {
	return el("button", { class: "bd-btn buy__add", "data-bd-add": true, disabled: !price.ready, type: "button" }, [
		price.amount === null ? "Sold out" : !price.ready ? "Choose options" : "Add to cart",
	]);
}
