// [bd-file:store]
import type { Price } from "./shop";

/** "Add to cart", or why it can't be yet: "Choose options", "Sold out". */
export function AddToCartButton({
	price,
	busy,
	onAdd,
}: {
	price: Price;
	/** True while the add is on its way. */
	busy: boolean;
	onAdd: () => void;
}) {
	const label =
		price.amount === null
			? "Sold out"
			: !price.ready
				? "Choose options"
				: busy
					? "Adding…"
					: "Add to cart";
	return (
		<button
			className="bd-btn buy__add"
			disabled={busy || !price.ready}
			onClick={onAdd}
			type="button"
		>
			{label}
		</button>
	);
}
