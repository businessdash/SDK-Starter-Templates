// [bd-file:store]
import { el, money } from "/bd.js";
import { starRating } from "/shop/shop-elements.js";
import { saveButtons } from "./save-buttons.js";

/**
 * A product in the store's grid: its photo and badges (Best seller, New,
 * Sale), name, stars, price ("From" when options change it, the old price
 * on sale), Low stock, and ♡ / ⇄ to save it or pick it to compare. `p` is
 * a card from listProductsWithMeta (prices in cents).
 */
export function productCard(p, { storeHref = "/store" } = {}) {
	return el("div", { class: "bd-card product-card" }, [
		el("a", { class: "product-card__link", href: `${storeHref}/${encodeURIComponent(p.id)}` }, [
			el("div", { class: "product-card__media" }, [
				p.coverImage
					? el("img", {
							alt: p.name,
							class: "product-card__img",
							loading: "lazy",
							referrerpolicy: "no-referrer",
							src: p.coverImage,
						})
					: el("div", { class: "product-card__noimg" }, ["No image"]),
				el("div", { class: "product-card__badges" }, [
					p.isBestSeller ? el("span", { class: "bd-badge" }, ["Best seller"]) : null,
					p.isNew ? el("span", { class: "bd-badge" }, ["New"]) : null,
					p.isOnSale ? el("span", { class: "bd-badge product-card__badge--sale" }, ["Sale"]) : null,
				]),
			]),
			el("div", { class: "product-card__body" }, [
				el("h3", {}, [p.name || "Untitled"]),
				p.reviewCount > 0
					? el("div", { class: "product-card__rating" }, [
							starRating(p.avgRating),
							el("span", { class: "product-card__count" }, [`(${p.reviewCount})`]),
						])
					: null,
				el("div", { class: "product-card__price" }, [
					el("span", { class: "product-card__amount" }, [
						p.cheapestPriceCents != null
							? `${p.hasMultipleVariants ? "From " : ""}${money(p.cheapestPriceCents)}`
							: "View details",
					]),
					p.isOnSale && p.comparePriceCents != null
						? el("span", { class: "product-card__compare" }, [money(p.comparePriceCents)])
						: null,
				]),
				p.isLowStock ? el("span", { class: "product-card__lowstock" }, ["Low stock"]) : null,
			]),
		]),
		el("div", { class: "product-card__save" }, [
			saveButtons(
				{ id: p.id, name: p.name, image: p.coverImage, priceCents: p.cheapestPriceCents },
				{ compact: true },
			),
		]),
	]);
}
