// [bd-file:store]
import type { Price } from "../../../lib/shop/shop";

/** Add to cart; "Choose options" until every option is picked, Sold out when there's none. */
export function AddToCartButton({ price }: { price: Price }) {
	return (
		<button
			class="bd-btn buy__add"
			data-bd-add=""
			disabled={!price.ready}
			type="button"
		>
			{price.amount === null
				? "Sold out"
				: !price.ready
					? "Choose options"
					: "Add to cart"}
		</button>
	);
}
