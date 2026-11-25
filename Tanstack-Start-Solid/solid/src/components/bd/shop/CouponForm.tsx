// [bd-file:store]
import { createSignal, Show } from "solid-js";

/** The cart's coupon: a code box with Apply, or Remove for the applied code. */
export function CouponForm(props: {
	/** The applied code, if there is one. */
	code: string | null | undefined;
	disabled: boolean;
	onApply: (code: string) => void;
	onRemove: () => void;
}) {
	const [draft, setDraft] = createSignal("");
	return (
		<div style="display: flex; gap: 0.5rem; align-items: flex-end;">
			<div style="flex: 1;">
				<label class="bd-label" for="coupon">
					Coupon code
				</label>
				<input
					id="coupon"
					class="bd-input"
					placeholder="SAVE10"
					value={draft()}
					onInput={(e) => setDraft(e.currentTarget.value)}
				/>
			</div>
			<Show
				when={props.code}
				fallback={
					<button
						type="button"
						class="bd-btn bd-btn--ghost"
						disabled={props.disabled}
						onClick={() => {
							if (draft().trim()) props.onApply(draft().trim());
						}}
					>
						Apply
					</button>
				}
			>
				<button
					type="button"
					class="bd-btn bd-btn--ghost"
					disabled={props.disabled}
					onClick={() => props.onRemove()}
				>
					Remove {props.code}
				</button>
			</Show>
		</div>
	);
}
