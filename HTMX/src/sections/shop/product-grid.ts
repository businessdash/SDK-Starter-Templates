// [bd-file:store]
import { html, type Raw } from "../../html";
import { type ListedProduct, productCard } from "./product-card";

/** The store's products, a product card each. */
export function productGrid(products: ListedProduct[], { storeHref = "/store" } = {}): Raw {
	return html`<div class="bd-grid-3">${products.map((p) => productCard(p, { storeHref }))}</div>`;
}
