// [bd-file:store]
import { html, type Raw } from "../../html";
import type { SavedProduct } from "../../shop/shop";

/**
 * What this browser opened before, as a rail; this product joins the list
 * for next time. The list lives in this browser, so `<bd-recently-viewed>`
 * (src/shop/shop-elements.ts) draws the rail there.
 */
export function recentlyViewed(product: SavedProduct, { storeHref = "/store" } = {}): Raw {
	return html`<bd-recently-viewed data-product="${JSON.stringify(product)}" data-store-href="${storeHref}"></bd-recently-viewed>`;
}
