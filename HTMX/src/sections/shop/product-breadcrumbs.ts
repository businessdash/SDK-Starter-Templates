// [bd-file:store]
import { html, type Raw } from "../../html";
import type { ProductView } from "../../shop/shop";

/** Store / Category / This product. */
export function productBreadcrumbs(product: ProductView, { storeHref = "/store" } = {}): Raw {
	return html`<nav aria-label="Breadcrumb" class="crumbs">
		<a href="${storeHref}">Store</a>
		${
			product.categoryId
				? html`<span aria-hidden="true">/</span>
					<a href="${`${storeHref}?category=${encodeURIComponent(product.categoryId)}`}">${product.categoryName ?? "Category"}</a>`
				: ""
		}
		<span aria-hidden="true">/</span>
		<span aria-current="page">${product.name}</span>
	</nav>`;
}
