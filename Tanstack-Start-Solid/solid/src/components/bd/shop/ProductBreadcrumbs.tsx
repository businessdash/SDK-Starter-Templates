// [bd-file:store]
import { Show } from "solid-js";

import type { ProductView } from "../../../lib/shop/shop";

/** Store / Category / This product. */
export function ProductBreadcrumbs(props: {
	product: ProductView;
	storeHref?: string;
}) {
	const store = () => props.storeHref ?? "/store";
	return (
		<nav aria-label="Breadcrumb" class="crumbs">
			<a href={store()}>Store</a>
			<Show when={props.product.categoryId}>
				{(id) => (
					<>
						<span aria-hidden="true">/</span>
						<a href={`${store()}?category=${encodeURIComponent(id())}`}>
							{props.product.categoryName ?? "Category"}
						</a>
					</>
				)}
			</Show>
			<span aria-hidden="true">/</span>
			<span aria-current="page">{props.product.name}</span>
		</nav>
	);
}
