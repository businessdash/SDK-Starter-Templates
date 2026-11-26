// [bd-file:store]
import { component$, type PropFunction } from "@builder.io/qwik";

import { formatDollars } from "../../../lib/bd-store";

/** Clear cart, and the subtotal (dollars). */
export const CartSummary = component$<{
	subtotal: number;
	currency: string;
	disabled: boolean;
	onClear$: PropFunction<() => void>;
}>(({ subtotal, currency, disabled, onClear$ }) => {
	return (
		<div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.5rem;">
			<button
				class="bd-btn bd-btn--ghost"
				disabled={disabled}
				onClick$={() => onClear$()}
				type="button"
			>
				Clear cart
			</button>
			<div style="font-size: 1.15rem; font-weight: 700; color: var(--title);">
				{formatDollars(subtotal, currency)}
			</div>
		</div>
	);
});
