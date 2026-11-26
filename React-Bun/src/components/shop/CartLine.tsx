// [bd-file:store]
import { dollars, type Loose } from "../../lib/bd";

/**
 * One line of the cart: photo, name and option, the price each, − and +
 * (down to 0 removes it), the line total and Remove.
 */
export function CartLine({
	item,
	currency,
	onQuantity,
	onRemove,
}: {
	item: Loose;
	currency: string;
	onQuantity: (quantity: number) => void;
	onRemove: () => void;
}) {
	return (
		<li className="cart-item">
			{item.productImage ? <img className="cart-item__img" src={item.productImage} alt={item.productName ?? ""} /> : null}
			<div className="cart-item__main">
				<div className="cart-item__name">{item.productName ?? "Item"}</div>
				{item.variantTitle ? <div className="cart-item__variant">{item.variantTitle}</div> : null}
				<div className="cart-item__price">{dollars(item.unitPrice, item.currency ?? currency)} each</div>
			</div>
			<div className="cart-qty">
				<button
					className="cart-qty__btn"
					type="button"
					aria-label="Decrease"
					onClick={() => onQuantity(Math.max(0, item.quantity - 1))}
				>
					−
				</button>
				<span className="cart-qty__n">{item.quantity}</span>
				<button
					className="cart-qty__btn"
					type="button"
					aria-label="Increase"
					onClick={() => onQuantity(item.quantity + 1)}
				>
					+
				</button>
			</div>
			<div className="cart-item__subtotal">{dollars(item.subtotal, item.currency ?? currency)}</div>
			<button className="cart-item__remove" type="button" onClick={onRemove}>
				Remove
			</button>
		</li>
	);
}
