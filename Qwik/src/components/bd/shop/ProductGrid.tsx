// [bd-file:store]
import type { StorefrontProductCard } from "@businessdash/sdk/contracts";

import { ProductCard } from "./ProductCard";

/** The store's products, a <ProductCard> each. */
export function ProductGrid({ products, storeHref }: { products: StorefrontProductCard[]; storeHref?: string }) {
	return (
		<div class="bd-grid-3">
			{products.map((p) => (
				<ProductCard key={p.id} product={p} storeHref={storeHref} />
			))}
		</div>
	);
}
