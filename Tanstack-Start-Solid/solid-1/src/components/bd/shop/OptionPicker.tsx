// [bd-file:store]
import { For } from "solid-js";

import type { OptionGroup } from "../../../lib/shop/shop";

/**
 * One option group (Size, Colour…): a button per value, the chosen value's
 * name beside the title. A group that belongs to one variant shows only
 * while that variant is chosen.
 */
export function OptionPicker(props: {
	group: OptionGroup & { variantId: string | null };
	hidden: boolean;
}) {
	return (
		<fieldset
			class="choice"
			data-bd-for-variant={props.group.variantId ?? undefined}
			data-bd-group={props.group.id}
			hidden={props.hidden}
		>
			<legend class="bd-label">
				{props.group.title}
				<span class="choice__picked" data-bd-picked hidden />
			</legend>
			<div class="choice__values">
				<For each={props.group.values}>
					{(value) => (
						<button
							aria-pressed="false"
							class="choice__value"
							data-bd-value={value.id}
							disabled={!value.available}
							title={value.available ? undefined : "Sold out"}
							type="button"
						>
							{value.value}
						</button>
					)}
				</For>
			</div>
		</fieldset>
	);
}
