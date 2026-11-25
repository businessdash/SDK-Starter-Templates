// [bd-file:store]
import { ProductCard } from "./ProductCard";
import type { StoreCard } from "./StoreView";

/** The store's products, a <ProductCard> each. */
export function ProductGrid({ products }: { products: StoreCard[] }) {
	return (
		<div className="bd-grid-3">
			{products.map((p) => (
				<ProductCard key={p.id} product={p} />
			))}
		</div>
	);
}
