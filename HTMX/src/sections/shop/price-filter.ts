// [bd-file:store]
import { html, type Raw } from "../../html";
import { keep } from "./store-filters";

/**
 * Lowest and highest price in dollars (?priceMin, ?priceMax) with Apply, a
 * GET form. `range` is what the store's products cost.
 */
export function priceFilter(
	params: URLSearchParams,
	range: { minDollars: number; maxDollars: number } | null | undefined,
	{ storeHref = "/store" } = {},
): Raw {
	return html`<form action="${storeHref}" class="store-facet" method="get">
		<p class="store-facet__title">Price</p>
		<div class="store-price">
			<input aria-label="Lowest price" class="bd-input" inputmode="decimal" name="priceMin" placeholder="${range ? `$${Math.floor(range.minDollars)}` : "Min"}" value="${params.get("priceMin") ?? ""}" />
			<span aria-hidden="true" class="store-price__sep">–</span>
			<input aria-label="Highest price" class="bd-input" inputmode="decimal" name="priceMax" placeholder="${range ? `$${Math.ceil(range.maxDollars)}` : "Max"}" value="${params.get("priceMax") ?? ""}" />
		</div>
		${keep(params, "priceMin", "priceMax")}
		<button class="bd-btn bd-btn--ghost store-price__apply" type="submit">Apply</button>
	</form>`;
}
