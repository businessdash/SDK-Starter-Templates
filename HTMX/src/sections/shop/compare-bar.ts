// [bd-file:store]
import { html, type Raw } from "../../html";

/** The products picked to compare, with Compare and Clear, by `<bd-compare-bar>`. */
export function compareBar({ storeHref = "/store" } = {}): Raw {
	return html`<bd-compare-bar data-store-href="${storeHref}"></bd-compare-bar>`;
}
