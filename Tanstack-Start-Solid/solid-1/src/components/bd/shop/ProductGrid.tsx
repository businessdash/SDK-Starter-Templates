// [bd-file:store]
import type { StorefrontProductCard } from "@businessdash/sdk/contracts";
import { For } from "solid-js";

import { ProductCard } from "./ProductCard";

/** The store's products, a <ProductCard> each. */
export function ProductGrid(props: { products: StorefrontProductCard[] }) {
	return (
		<div class="bd-grid-3">
			<For each={props.products}>{(p) => <ProductCard product={p} />}</For>
		</div>
	);
}
