// [bd-file:store]
import type { OptionGroup } from "../../../lib/shop/shop";

/**
 * One option group (Size, Colour…): a button per value, the chosen value's
 * name beside the title. A group that belongs to one variant shows only
 * while that variant is chosen.
 */
export function OptionPicker({ group, hidden }: { group: OptionGroup & { variantId: string | null }; hidden: boolean }) {
	return (
		<fieldset
			class="choice"
			data-bd-for-variant={group.variantId ?? undefined}
			data-bd-group={group.id}
			hidden={hidden}
		>
			<legend class="bd-label">
				{group.title}
				<span class="choice__picked" data-bd-picked="" hidden />
			</legend>
			<div class="choice__values">
				{group.values.map((value) => (
					<button
						aria-pressed="false"
						class="choice__value"
						data-bd-value={value.id}
						disabled={!value.available}
						key={value.id}
						title={value.available ? undefined : "Sold out"}
						type="button"
					>
						{value.value}
					</button>
				))}
			</div>
		</fieldset>
	);
}
