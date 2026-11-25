// [bd-file:store]
import { el } from "/bd.js";
import { starRating } from "/shop/shop-elements.js";

/** The category, the name, and the stars linking to the reviews. */
export function productTitle(product, reviews) {
	return el("div", {}, [
		product.categoryName ? el("p", { class: "product-detail__eyebrow" }, [product.categoryName]) : null,
		el("h1", {}, [product.name]),
		reviews && reviews.totalCount > 0
			? el("a", { class: "product-detail__rating", href: "#reviews" }, [
					starRating(reviews.avgRating),
					el("span", {}, [`${reviews.avgRating.toFixed(1)} · ${reviews.totalCount} reviews`]),
				])
			: null,
	]);
}
