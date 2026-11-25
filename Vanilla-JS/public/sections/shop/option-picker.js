// [bd-file:store]
import { el } from "/bd.js";

/**
 * One option group (Size, Colour…): a button per value, the chosen value's
 * name beside the title. A group that belongs to one variant shows only
 * while that variant is chosen. `group` is from allOptionGroups().
 */
export function optionPicker(group, { hidden = false } = {}) {
	return el(
		"fieldset",
		{ class: "choice", "data-bd-for-variant": group.variantId, "data-bd-group": group.id, hidden },
		[
			el("legend", { class: "bd-label" }, [
				group.title,
				el("span", { class: "choice__picked", "data-bd-picked": true, hidden: true }, []),
			]),
			el(
				"div",
				{ class: "choice__values" },
				group.values.map((value) =>
					el(
						"button",
						{
							"aria-pressed": "false",
							class: "choice__value",
							"data-bd-value": value.id,
							disabled: !value.available,
							title: value.available ? null : "Sold out",
							type: "button",
						},
						[value.value],
					),
				),
			),
		],
	);
}
