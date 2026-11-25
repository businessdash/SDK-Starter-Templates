// [bd-file:store]
/**
 * The cart's coupon: a code box with Apply (and a note, such as "Invalid
 * code"), or the applied code with Remove.
 */
export function CouponForm({
	code,
	message,
	onApply,
	onRemove,
}: {
	/** The applied code, if there is one. */
	code: string | null | undefined;
	message: string;
	onApply: (code: string) => void;
	onRemove: () => void;
}) {
	return code ? (
		<div className="coupon coupon--applied">
			<span>Coupon {code} applied</span>
			<button className="btn btn--ghost btn--sm" type="button" onClick={onRemove}>
				Remove
			</button>
		</div>
	) : (
		<form
			className="coupon"
			onSubmit={(e) => {
				e.preventDefault();
				onApply((new FormData(e.currentTarget).get("code") as string)?.trim() ?? "");
			}}
		>
			<input className="coupon__input" type="text" name="code" placeholder="Coupon code" aria-label="Coupon code" />
			<button className="btn btn--ghost btn--sm" type="submit">
				Apply
			</button>
			<span className="coupon__msg">{message}</span>
		</form>
	);
}
