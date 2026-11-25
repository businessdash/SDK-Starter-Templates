// [bd-file:store]
import { el } from "/bd.js";
import { formatCents } from "/shop/shop.js";

/** A row of small product cards: related products. Each is { id, name, image, priceCents }. */
export function productRail(title, products, { storeHref = "/store" } = {}) {
	if (products.length === 0) return null;
	return el("section", { class: "product-rail" }, [
		el("h2", { class: "product-rail__title" }, [title]),
		el(
			"ul",
			{ class: "product-rail__row" },
			products.map((product) =>
				el("li", {}, [
					el("a", { class: "bd-card product-rail__card", href: `${storeHref}/${encodeURIComponent(product.id)}` }, [
						product.image
							? el("img", { alt: "", loading: "lazy", referrerpolicy: "no-referrer", src: product.image })
							: el("span", { "aria-hidden": "true", class: "product-rail__noimg" }, []),
						el("span", { class: "product-rail__name" }, [product.name]),
						product.priceCents != null
							? el("span", { class: "product-rail__price" }, [formatCents(product.priceCents)])
							: null,
					]),
				]),
			),
		),
	]);
}
