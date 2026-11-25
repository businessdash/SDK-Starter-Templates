// [bd-file:store]
import { el } from "/bd.js";

/** After adding: "Added 2 to your cart." with View cart, or what went wrong. */
export function cartNotice(cartHref) {
	return el("div", { class: "product-detail__msg", "data-bd-notice": true, hidden: true, role: "status" }, [
		el("span", { "data-bd-notice-text": true }, []),
		el("a", { class: "bd-btn bd-btn--ghost", "data-bd-notice-link": true, href: cartHref }, ["View cart"]),
	]);
}
