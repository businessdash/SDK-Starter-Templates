// [bd-file:store]
import { formatDollars, type ProductVariant } from "./shop";

/**
 * A button per variant (style); sold-out ones are disabled. Nothing when
 * there is only one. `showPrices` puts each variant's price on its button.
 */
export function VariantPicker({
	variants,
	selected,
	showPrices,
	onSelect,
}: {
	variants: ProductVariant[];
	selected: string;
	showPrices: boolean;
	onSelect: (variantId: string) => void;
}) {
	if (variants.length <= 1) return null;
	return (
		<fieldset className="choice">
			<legend className="bd-label">Option</legend>
			<div className="choice__values">
				{variants.map((v) => (
					<button
						aria-pressed={v.id === selected}
						className={`choice__value${v.id === selected ? " choice__value--on" : ""}`}
						disabled={!v.available}
						key={v.id}
						onClick={() => onSelect(v.id)}
						type="button"
					>
						{v.name}
						{v.price != null && showPrices && (
							<small> {formatDollars(v.price)}</small>
						)}
					</button>
				))}
			</div>
		</fieldset>
	);
}
