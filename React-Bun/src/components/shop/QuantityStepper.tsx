// [bd-file:store]
/** − and + around the quantity, from 1 up to `max` (or 999). */
export function QuantityStepper({
	quantity,
	max,
	onChange,
}: {
	quantity: number;
	/** How many are in stock; null when stock isn't tracked. */
	max: number | null;
	onChange: (quantity: number) => void;
}) {
	return (
		// biome-ignore lint/a11y/useSemanticElements: one inline stepper; a fieldset would bring its own border and legend layout
		<div aria-label="Quantity" className="qty" role="group">
			<button
				aria-label="One fewer"
				disabled={quantity <= 1}
				onClick={() => onChange(Math.max(1, quantity - 1))}
				type="button"
			>
				−
			</button>
			<span aria-live="polite">{quantity}</span>
			<button
				aria-label="One more"
				disabled={max != null && quantity >= max}
				onClick={() => onChange(Math.min(999, quantity + 1))}
				type="button"
			>
				+
			</button>
		</div>
	);
}
