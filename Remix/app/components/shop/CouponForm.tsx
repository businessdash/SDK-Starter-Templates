// [bd-file:store]
import { Form } from "react-router";

/**
 * The cart's coupon: a code box with Apply, or the applied code with
 * Remove (intents "apply-coupon" and "remove-coupon").
 */
export function CouponForm({ code }: { code: string | null | undefined }) {
	return code ? (
		<Form className="coupon" method="post">
			<span className="muted">Coupon: {code}</span>
			<input name="intent" type="hidden" value="remove-coupon" />
			<button className="link-btn" type="submit">
				Remove
			</button>
		</Form>
	) : (
		<Form className="coupon" method="post">
			<input name="intent" type="hidden" value="apply-coupon" />
			<input aria-label="Coupon code" name="code" placeholder="Coupon code" />
			<button className="link-btn" type="submit">
				Apply
			</button>
		</Form>
	);
}
