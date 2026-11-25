// [bd-file:store]
import { ProductCard, type ProductCardData } from "./ProductCard";

/** The store's products, a <ProductCard> each. */
export function ProductGrid({ products }: { products: ProductCardData[] }) {
	return (
		<div className="bd-grid-3">
			{products.map((p) => (
				<ProductCard key={p.id} product={p} />
			))}
		</div>
	);
}
