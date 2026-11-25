// [bd-file:store]
import { el } from "/bd.js";

/** "Only 3 left", at five or fewer. */
export function stockNote(stock) {
	const low = stock != null && stock > 0 && stock <= 5;
	return el("p", { class: "product-detail__stock", "data-bd-stock": true, hidden: !low }, [
		low ? `Only ${stock} left` : "",
	]);
}
