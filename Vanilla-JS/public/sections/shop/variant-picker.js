// [bd-file:store]
import { el } from "/bd.js";
import { formatDollars } from "/shop/shop.js";

/**
 * A button per variant (Cloud, Storm…), the chosen one pressed; sold-out
 * ones can't be pressed. Nothing shows for a product with one variant. A
 * variant's price shows on its button while it has no options of its own.
 */
export function variantPicker({ variants, selected, showPrices }) {
	if (variants.length <= 1) return null;
	return el("fieldset", { class: "choice" }, [
		el("legend", { class: "bd-label" }, ["Option"]),
		el(
			"div",
			{ class: "choice__values" },
			variants.map((v) =>
				el(
					"button",
					{
						"aria-pressed": v.id === selected ? "true" : "false",
						class: `choice__value${v.id === selected ? " choice__value--on" : ""}`,
						"data-bd-variant": v.id,
						disabled: !v.available,
						type: "button",
					},
					[
						v.name,
						v.price != null
							? el("small", { "data-bd-variant-price": true, hidden: !showPrices }, [` ${formatDollars(v.price)}`])
							: null,
					],
				),
			),
		),
	]);
}
