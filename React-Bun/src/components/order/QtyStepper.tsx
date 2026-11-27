// [bd-file:ordering]
/** − 2 + : the quantity control on the tray and in the choice sheet. */
export function QtyStepper({
	value,
	onChange,
	min = 0,
	max = 50,
	label,
}: {
	value: number;
	onChange: (next: number) => void;
	/** 0 lets the minus button remove the line. */
	min?: number;
	max?: number;
	/** What is being counted, for screen readers: "Margherita". */
	label: string;
}) {
	return (
		<div className="order-qty" role="group" aria-label={`Quantity of ${label}`}>
			<button
				type="button"
				className="order-qty__btn"
				onClick={() => onChange(value - 1)}
				disabled={value <= min}
				aria-label={value - 1 <= 0 ? `Remove ${label}` : `One fewer ${label}`}
			>
				−
			</button>
			<span className="order-qty__value" aria-live="polite">
				{value}
			</span>
			<button
				type="button"
				className="order-qty__btn"
				onClick={() => onChange(value + 1)}
				disabled={value >= max}
				aria-label={`One more ${label}`}
			>
				+
			</button>
		</div>
	);
}
