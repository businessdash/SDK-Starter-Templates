// [bd-file:store]
/** − and + around how many to add, from 1 up to what's in stock. */
export function QuantityStepper({ quantity = 1, max }: { quantity?: number; max: number | null }) {
	return (
		<div aria-label="Quantity" class="qty" role="group">
			<button aria-label="One fewer" data-bd-qty="-1" disabled={quantity <= 1} type="button">
				−
			</button>
			<span aria-live="polite" data-bd-qty-value="">
				{quantity}
			</span>
			<button aria-label="One more" data-bd-qty="1" disabled={max != null && quantity >= max} type="button">
				+
			</button>
		</div>
	);
}
