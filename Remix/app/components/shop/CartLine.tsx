// [bd-file:store]
import { Form } from "react-router";
import { formatDollars } from "./shop";

/** A cart line as the cart page's loader gives it. */
export type CartLineItem = {
	id: string;
	name: string;
	variantTitle: string | null;
	image: string | null;
	quantity: number;
	/** Dollars. */
	lineTotal: number;
};

/**
 * One line of the cart: photo, name and option, a quantity box with
 * Update, the line total and Remove. Both buttons post to the cart page's
 * action (intent "update" or "remove").
 */
export function CartLine({
	item,
	currency,
}: {
	item: CartLineItem;
	currency: string;
}) {
	return (
		<li className="cart-row">
			{item.image ? (
				<img alt={item.name} className="cart-row__img" src={item.image} />
			) : null}
			<div className="cart-row__body">
				<strong>{item.name}</strong>
				{item.variantTitle ? (
					<span className="muted"> · {item.variantTitle}</span>
				) : null}
			</div>
			<Form className="cart-row__qty" method="post">
				<input name="intent" type="hidden" value="update" />
				<input name="itemId" type="hidden" value={item.id} />
				<input
					aria-label="Quantity"
					defaultValue={item.quantity}
					min={0}
					name="quantity"
					type="number"
				/>
				<button className="link-btn" type="submit">
					Update
				</button>
			</Form>
			<span className="price">{formatDollars(item.lineTotal, currency)}</span>
			<Form method="post">
				<input name="intent" type="hidden" value="remove" />
				<input name="itemId" type="hidden" value={item.id} />
				<button className="link-btn link-btn--danger" type="submit">
					Remove
				</button>
			</Form>
		</li>
	);
}
