// [bd-file:store]
import { html, type Raw } from "../../html";

/** Clear all filters: the store with none. */
export function clearFilters({ storeHref = "/store" } = {}): Raw {
	return html`<a class="store-clear" href="${storeHref}">Clear all filters</a>`;
}
