// [bd-file:store]
/**
 * /store/wishlist — products saved on this device with ♡ Save, to open and
 * buy later. The list lives in this browser; `<bd-wishlist>` from
 * /shop/shop-elements.js draws it.
 */
import "/shop/shop-elements.js";
import { el } from "/bd.js";
import { mountStoreNav } from "./_store-nav.js";

export default async function render(root) {
	mountStoreNav();
	root.replaceChildren(
		el("div", { class: "bd-section__lead" }, [
			el("span", { class: "bd-section__eyebrow" }, ["Shop"]),
			el("h1", { class: "bd-section__title" }, ["Wishlist"]),
			el("p", { class: "bd-section__sub" }, ["Products you saved on this device."]),
		]),
		el("bd-wishlist", { "data-store-href": "/store" }, []),
	);
}
