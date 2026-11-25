// [bd-file:store]
import { html, type Raw } from "../../html";
import { keep, SORTS, SWAP, sortOf } from "./store-filters";

/** Featured, Newest, Price either way, Top rated (?sort): a GET form that applies as soon as it changes. */
export function sortSelect(params: URLSearchParams, { storeHref = "/store" } = {}): Raw {
	const sort = sortOf(params);
	return html`<form action="${storeHref}" class="store-sort" method="get" ${SWAP}>
		<label for="store-sort">Sort</label>
		<select class="bd-select" id="store-sort" name="sort" onchange="this.form.requestSubmit()">
			${SORTS.map((s) => html`<option value="${s.value}"${s.value === sort ? html` selected` : ""}>${s.label}</option>`)}
		</select>
		${keep(params, "sort")}
		<noscript><button class="bd-btn bd-btn--ghost" type="submit">Sort</button></noscript>
	</form>`;
}
