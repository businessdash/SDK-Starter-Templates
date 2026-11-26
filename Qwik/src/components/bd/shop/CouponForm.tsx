// [bd-file:store]
import { component$, type PropFunction, useSignal } from "@builder.io/qwik";

/** The cart's coupon: a code box with Apply, or Remove coupon for the applied code. */
export const CouponForm = component$<{
	/** The applied code, if there is one. */
	code: string | null | undefined;
	disabled: boolean;
	onApply$: PropFunction<(code: string) => void>;
	onRemove$: PropFunction<() => void>;
}>(({ code, disabled, onApply$, onRemove$ }) => {
	const draft = useSignal("");
	return (
		<div style="display: flex; gap: 0.5rem; align-items: flex-end;">
			<div style="flex: 1;">
				<label class="bd-label" for="coupon">
					Coupon
				</label>
				<input
					bind:value={draft}
					class="bd-input"
					id="coupon"
					placeholder={code ?? "Code"}
				/>
			</div>
			{code ? (
				<button
					class="bd-btn bd-btn--ghost"
					disabled={disabled}
					onClick$={() => onRemove$()}
					type="button"
				>
					Remove coupon
				</button>
			) : (
				<button
					class="bd-btn bd-btn--ghost"
					disabled={disabled || !draft.value}
					onClick$={() => onApply$(draft.value)}
					type="button"
				>
					Apply
				</button>
			)}
		</div>
	);
});
