// [bd-file:store]
import type { ProductView } from "../../../lib/shop/shop";

/** Store / Category / This product. */
export function ProductBreadcrumbs({ product, storeHref = "/store" }: { product: ProductView; storeHref?: string }) {
	return (
		<nav aria-label="Breadcrumb" class="crumbs">
			<a href={storeHref}>Store</a>
			{product.categoryId ? (
				<>
					<span aria-hidden="true">/</span>
					<a href={`${storeHref}?category=${encodeURIComponent(product.categoryId)}`}>
						{product.categoryName ?? "Category"}
					</a>
				</>
			) : null}
			<span aria-hidden="true">/</span>
			<span aria-current="page">{product.name}</span>
		</nav>
	);
}
