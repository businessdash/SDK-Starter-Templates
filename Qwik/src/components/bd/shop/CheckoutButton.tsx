// [bd-file:store]
import { component$, type PropFunction } from "@builder.io/qwik";

/** Checkout with Stripe; "Working…" while a change is on its way. */
export const CheckoutButton = component$<{
	busy: boolean;
	onCheckout$: PropFunction<() => void>;
}>(({ busy, onCheckout$ }) => {
	return (
		<button
			class="bd-btn"
			disabled={busy}
			onClick$={() => onCheckout$()}
			type="button"
		>
			{busy ? "Working…" : "Checkout with Stripe"}
		</button>
	);
});
