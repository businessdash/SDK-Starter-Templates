// [bd-file:store]
import { For, Show } from "solid-js";

import { formatDollars, type ProductVariant } from "../../../lib/shop/shop";

/**
 * A button per variant (Cloud, Storm…), the chosen one pressed; sold-out
 * ones can't be pressed. Nothing shows for a product with one variant. A
 * variant's price shows on its button while it has no options of its own.
 */
export function VariantPicker(props: {
	variants: ProductVariant[];
	selected: string;
	showPrices: boolean;
}) {
	return (
		<Show when={props.variants.length > 1}>
			<fieldset class="choice">
				<legend class="bd-label">Option</legend>
				<div class="choice__values">
					<For each={props.variants}>
						{(v) => (
							<button
								aria-pressed={v.id === props.selected ? "true" : "false"}
								class={`choice__value${v.id === props.selected ? " choice__value--on" : ""}`}
								data-bd-variant={v.id}
								disabled={!v.available}
								type="button"
							>
								{v.name}
								<Show when={v.price != null}>
									<small data-bd-variant-price hidden={!props.showPrices}>
										{` ${formatDollars(v.price ?? 0)}`}
									</small>
								</Show>
							</button>
						)}
					</For>
				</div>
			</fieldset>
		</Show>
	);
}
