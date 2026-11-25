// [bd-file:store]
"use client";

import { useState } from "react";

/** The cart's coupon: a code box with Apply, or the applied code with Remove. */
export function CouponForm({
	code,
	disabled,
	onApply,
	onRemove,
}: {
	/** The applied code, if there is one. */
	code: string | null | undefined;
	disabled: boolean;
	onApply: (code: string) => void;
	onRemove: () => void;
}) {
	const [draft, setDraft] = useState("");
	return code ? (
		<div className="cart__coupon">
			<span className="cart__couponOk">Coupon: {code}</span>
			<button
				className="cart__remove"
				disabled={disabled}
				onClick={onRemove}
				type="button"
			>
				Remove
			</button>
		</div>
	) : (
		<div className="cart__couponRow">
			<input
				className="bd-input"
				onChange={(e) => setDraft(e.target.value)}
				placeholder="Coupon code"
				value={draft}
			/>
			<button
				className="bd-btn bd-btn--ghost"
				disabled={disabled || !draft.trim()}
				onClick={() => onApply(draft.trim())}
				type="button"
			>
				Apply
			</button>
		</div>
	);
}
