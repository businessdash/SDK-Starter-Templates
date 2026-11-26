// [bd-file:store]
import { formatMoney } from "../money";

/** The subtotal (dollars). */
export function CartSummary(props: {
	subtotal: number;
	currency: string | undefined;
}) {
	return (
		<div style="display: flex; justify-content: space-between; font-weight: 700; color: var(--title); font-size: 1.1rem; padding-top: 0.5rem;">
			<span>Subtotal</span>
			<span>
				{formatMoney(Math.round(props.subtotal * 100), props.currency)}
			</span>
		</div>
	);
}
