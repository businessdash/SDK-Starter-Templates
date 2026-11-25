// [bd-file:store]
import { dollars, el } from "/bd.js";

/** The subtotal and how many items (cart amounts are dollars). */
export function cartSummary(cart, currency) {
	return el("div", { class: "cart-summary" }, [
		el("div", { class: "cart-summary__row" }, [
			el("span", {}, [`Subtotal (${cart.itemCount} item${cart.itemCount === 1 ? "" : "s"})`]),
			el("strong", {}, [dollars(cart.subtotal, currency)]),
		]),
	]);
}
