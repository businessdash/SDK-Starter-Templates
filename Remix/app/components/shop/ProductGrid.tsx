// [bd-file:store]
import type { StorefrontProductCard } from "@businessdash/sdk/contracts";
import { ProductCard } from "./ProductCard";

/** The store's products, a <ProductCard> each. */
export function ProductGrid({
	products,
}: {
	products: StorefrontProductCard[];
}) {
	return (
		<div className="bd-grid-3">
			{products.map((p) => (
				<ProductCard key={p.id} product={p} />
			))}
		</div>
	);
}
