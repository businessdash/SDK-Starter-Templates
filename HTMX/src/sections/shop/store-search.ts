// [bd-file:store]
import { html, type Raw } from "../../html";
import { keep } from "./store-filters";

/** The search box (?q), a GET form that keeps the other filters. */
export function storeSearch(params: URLSearchParams, { storeHref = "/store" } = {}): Raw {
	return html`<form action="${storeHref}" method="get">
		<label class="bd-label" for="store-search">Search</label>
		<input autocomplete="off" class="bd-input" id="store-search" name="q" placeholder="Search products…" type="search" value="${params.get("q") ?? ""}" />
		${keep(params, "q")}
	</form>`;
}
