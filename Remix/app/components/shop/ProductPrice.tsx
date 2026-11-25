// [bd-file:store]
import { formatDollars, type Price } from "./shop";

/** The price for what's chosen, times the quantity ("From" until it's settled). */
export function ProductPrice({
	price,
	quantity,
}: {
	price: Price;
	quantity: number;
}) {
	return (
		<p className="product-detail__price">
			{price.amount != null ? (
				<>
					{price.from && <span className="product-detail__from">From</span>}{" "}
					{formatDollars(price.amount * quantity)}
					{quantity > 1 && (
						<span className="product-detail__each">
							{" "}
							({formatDollars(price.amount)} each)
						</span>
					)}
				</>
			) : (
				"Sold out"
			)}
		</p>
	);
}
