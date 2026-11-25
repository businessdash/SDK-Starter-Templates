// [bd-file:store]
/** Checkout with Stripe, and Clear. */
export function CartActions(props: {
	busy: boolean;
	onCheckout: () => void;
	onClear: () => void;
}) {
	return (
		<div style="display: flex; gap: 0.75rem;">
			<button
				type="button"
				class="bd-btn"
				style="flex: 1;"
				disabled={props.busy}
				onClick={() => props.onCheckout()}
			>
				{props.busy ? "Working…" : "Checkout with Stripe"}
			</button>
			<button
				type="button"
				class="bd-btn bd-btn--ghost"
				disabled={props.busy}
				onClick={() => props.onClear()}
			>
				Clear
			</button>
		</div>
	);
}
