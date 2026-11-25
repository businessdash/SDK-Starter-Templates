// [bd-file:store]
import type { Price } from "../../../lib/shop/shop";

/** Add to cart; "Choose options" until every option is picked, Sold out when there's none. */
export function AddToCartButton(props: { price: Price }) {
	return (
		<button
			class="bd-btn buy__add"
			data-bd-add
			disabled={!props.price.ready}
			type="button"
		>
			{props.price.amount === null
				? "Sold out"
				: !props.price.ready
					? "Choose options"
					: "Add to cart"}
		</button>
	);
}
