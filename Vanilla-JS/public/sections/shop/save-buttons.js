// [bd-file:store]
import { el } from "/bd.js";

/**
 * ♡ Save and ⇄ Compare; `compact` for just the symbols. The lists live in
 * this browser, so `<bd-save-buttons>` (/shop/shop-elements.js) draws the
 * buttons. `product` is { id, name, image, priceCents }.
 */
export function saveButtons(product, { compact = false } = {}) {
	return el("bd-save-buttons", { compact, "data-product": JSON.stringify(product) }, []);
}
