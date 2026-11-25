// [bd-file:store]
import { el } from "/bd.js";

/** Store / Category / This product. `product` is a ProductView (toProductView). */
export function productBreadcrumbs(product, { storeHref = "/store" } = {}) {
	return el("nav", { "aria-label": "Breadcrumb", class: "crumbs" }, [
		el("a", { href: storeHref }, ["Store"]),
		...(product.categoryId
			? [
					el("span", { "aria-hidden": "true" }, ["/"]),
					el("a", { href: `${storeHref}?category=${encodeURIComponent(product.categoryId)}` }, [
						product.categoryName ?? "Category",
					]),
				]
			: []),
		el("span", { "aria-hidden": "true" }, ["/"]),
		el("span", { "aria-current": "page" }, [product.name]),
	]);
}
