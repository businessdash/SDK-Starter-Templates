// [bd-file:store]
import { el } from "/bd.js";

/** − and + around how many to add, from 1 up to what's in stock (`max`). */
export function quantityStepper({ max, quantity = 1 }) {
	return el("div", { "aria-label": "Quantity", class: "qty", role: "group" }, [
		el("button", { "aria-label": "One fewer", "data-bd-qty": "-1", disabled: quantity <= 1, type: "button" }, ["−"]),
		el("span", { "aria-live": "polite", "data-bd-qty-value": true }, [String(quantity)]),
		el(
			"button",
			{ "aria-label": "One more", "data-bd-qty": "1", disabled: max != null && quantity >= max, type: "button" },
			["+"],
		),
	]);
}
