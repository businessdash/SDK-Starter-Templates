// [bd-file:store]
import { el } from "/bd.js";

/**
 * What this browser opened before, as a rail; this product joins the list
 * for next time. The list lives in this browser, so `<bd-recently-viewed>`
 * (/shop/shop-elements.js) draws the rail.
 */
export function recentlyViewed(product, { storeHref = "/store" } = {}) {
	return el("bd-recently-viewed", { "data-product": JSON.stringify(product), "data-store-href": storeHref }, []);
}
