// [bd-file:store]
import { html, type Raw } from "../../html";
import type { SavedProduct } from "../../shop/shop";

/**
 * ♡ Save and ⇄ Compare; `compact` for just the symbols. The lists live in
 * this browser, so `<bd-save-buttons>` (src/shop/shop-elements.ts) draws
 * the buttons there.
 */
export function saveButtons(product: SavedProduct, { compact = false } = {}): Raw {
	return html`<bd-save-buttons${compact ? html` compact` : ""} data-product="${JSON.stringify(product)}"></bd-save-buttons>`;
}
