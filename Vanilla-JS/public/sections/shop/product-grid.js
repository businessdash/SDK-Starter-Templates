// [bd-file:store]
import { el } from "/bd.js";
import { productCard } from "./product-card.js";

/** The store's products, a product card each. */
export function productGrid(products, { storeHref = "/store" } = {}) {
	return el(
		"div",
		{ class: "bd-grid-3" },
		products.map((p) => productCard(p, { storeHref })),
	);
}
