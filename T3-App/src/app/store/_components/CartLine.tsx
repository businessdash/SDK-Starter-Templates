// [bd-file:store]
import type { CartSnapshot } from "@businessdash/sdk/contracts";

import { usd } from "./store-utils";

/**
 * One line of the cart: photo, name and option, the line total, − and +
 * (down to 1), the price each and Remove. `disabled` while a change is on
 * its way.
 */
export function CartLine({
	item,
	currency,
	disabled,
	onQuantity,
	onRemove,
}: {
	item: CartSnapshot["items"][number];
	currency: string;
	disabled: boolean;
	onQuantity: (quantity: number) => void;
	onRemove: () => void;
}) {
	return (
		<li className="cart__item">
			<div className="cart__thumb">
				{item.productImage ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img alt={item.productName ?? "Product"} src={item.productImage} />
				) : null}
			</div>
			<div className="cart__line">
				<div className="cart__lineTop">
					<div>
						<p className="cart__name">{item.productName ?? "Product"}</p>
						{item.variantTitle ? (
							<p className="cart__variant">{item.variantTitle}</p>
						) : null}
					</div>
					<p className="cart__subtotal">{usd(item.subtotal, currency)}</p>
				</div>
				<div className="cart__controls">
					<button
						className="cart__step"
						disabled={disabled}
						onClick={() => onQuantity(Math.max(1, item.quantity - 1))}
						type="button"
					>
						−
					</button>
					<span className="cart__qty">{item.quantity}</span>
					<button
						className="cart__step"
						disabled={disabled}
						onClick={() => onQuantity(item.quantity + 1)}
						type="button"
					>
						+
					</button>
					<span className="cart__unit">{usd(item.unitPrice, currency)} ea</span>
					<button
						className="cart__remove"
						disabled={disabled}
						onClick={onRemove}
						type="button"
					>
						Remove
					</button>
				</div>
			</div>
		</li>
	);
}
