// [bd-file:store]
import { BdLink } from "../bd-link";
import type { ProductView } from "./shop";

/** Store / the product's category / the product. */
export function ProductBreadcrumbs({ product }: { product: ProductView }) {
	return (
		<nav aria-label="Breadcrumb" className="crumbs">
			<BdLink href="/store">Store</BdLink>
			{product.categoryId && (
				<>
					<span aria-hidden="true">/</span>
					<BdLink href={`/store?category=${product.categoryId}`}>
						{product.categoryName ?? "Category"}
					</BdLink>
				</>
			)}
			<span aria-hidden="true">/</span>
			<span aria-current="page">{product.name}</span>
		</nav>
	);
}
