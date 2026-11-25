// [bd-file:store]
import { html, type Raw } from "../../html";
import { formatDollars, type ProductVariant } from "../../shop/shop";

/**
 * A button per variant (Cloud, Storm…), the chosen one pressed; sold-out
 * ones can't be pressed. Nothing shows for a product with one variant. A
 * variant's price shows on its button while it has no options of its own.
 */
export function variantPicker(opts: { variants: ProductVariant[]; selected: string; showPrices: boolean }): Raw {
	const { variants, selected, showPrices } = opts;
	if (variants.length <= 1) return html``;
	return html`<fieldset class="choice">
		<legend class="bd-label">Option</legend>
		<div class="choice__values">${variants.map((v) => {
			const on = v.id === selected;
			return html`<button aria-pressed="${on ? "true" : "false"}" class="choice__value${on ? " choice__value--on" : ""}" data-bd-variant="${v.id}"${v.available ? "" : html` disabled`} type="button">${v.name}${
				v.price != null ? html`<small data-bd-variant-price${showPrices ? "" : html` hidden`}>${` ${formatDollars(v.price)}`}</small>` : ""
			}</button>`;
		})}</div>
	</fieldset>`;
}
