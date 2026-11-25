// [bd-file:store]
import { html, type Raw } from "../../html";
import type { OptionGroup } from "../../shop/shop";

/**
 * One option group (Size, Colour…): a button per value, the chosen value's
 * name beside the title. A group that belongs to one variant shows only
 * while that variant is chosen. `group` is from allOptionGroups().
 */
export function optionPicker(group: OptionGroup & { variantId: string | null }, { hidden = false } = {}): Raw {
	return html`<fieldset class="choice"${group.variantId ? html` data-bd-for-variant="${group.variantId}"` : ""} data-bd-group="${group.id}"${hidden ? html` hidden` : ""}>
		<legend class="bd-label">${group.title}<span class="choice__picked" data-bd-picked hidden></span></legend>
		<div class="choice__values">${group.values.map(
			(value) =>
				html`<button aria-pressed="false" class="choice__value" data-bd-value="${value.id}"${value.available ? "" : html` disabled title="Sold out"`} type="button">${value.value}</button>`,
		)}</div>
	</fieldset>`;
}
