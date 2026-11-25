// [bd-file:store]
import { html, type Raw } from "../../html";
import { money } from "../../layout";
import { saveButtons } from "./save-buttons";
import { starRating } from "./star-rating";

/** A product as listProductsWithMeta returns it (prices in cents). */
export type ListedProduct = {
	id: string;
	name: string;
	coverImage?: string | null;
	isBestSeller?: boolean;
	isNew?: boolean;
	isOnSale?: boolean;
	isLowStock?: boolean;
	reviewCount?: number | null;
	avgRating?: number | null;
	cheapestPriceCents?: number | null;
	comparePriceCents?: number | null;
	hasMultipleVariants?: boolean;
};

/**
 * A product in the store's grid: its photo and badges (Best seller, New,
 * Sale), name, stars, price ("From" when options change it, the old price
 * on sale), Low stock, and ♡ / ⇄ to save it or pick it to compare.
 */
export function productCard(p: ListedProduct, { storeHref = "/store" } = {}): Raw {
	return html`<div class="bd-card product-card">
		<a class="product-card__link" href="${`${storeHref}/${encodeURIComponent(p.id)}`}">
			<div class="product-card__media">
				${
					p.coverImage
						? html`<img alt="${p.name}" class="product-card__img" loading="lazy" referrerpolicy="no-referrer" src="${p.coverImage}" />`
						: html`<div class="product-card__noimg">No image</div>`
				}
				<div class="product-card__badges">
					${p.isBestSeller ? html`<span class="bd-badge">Best seller</span>` : ""}
					${p.isNew ? html`<span class="bd-badge">New</span>` : ""}
					${p.isOnSale ? html`<span class="bd-badge product-card__badge--sale">Sale</span>` : ""}
				</div>
			</div>
			<div class="product-card__body">
				<h3>${p.name || "Untitled"}</h3>
				${
					(p.reviewCount ?? 0) > 0
						? html`<div class="product-card__rating">${starRating(p.avgRating ?? 0)}<span class="product-card__count">(${String(p.reviewCount)})</span></div>`
						: ""
				}
				<div class="product-card__price">
					<span class="product-card__amount">${
						p.cheapestPriceCents != null ? `${p.hasMultipleVariants ? "From " : ""}${money(p.cheapestPriceCents)}` : "View details"
					}</span>
					${p.isOnSale && p.comparePriceCents != null ? html`<span class="product-card__compare">${money(p.comparePriceCents)}</span>` : ""}
				</div>
				${p.isLowStock ? html`<span class="product-card__lowstock">Low stock</span>` : ""}
			</div>
		</a>
		<div class="product-card__save">${saveButtons(
			{ id: p.id, name: p.name, image: p.coverImage ?? null, priceCents: p.cheapestPriceCents ?? null },
			{ compact: true },
		)}</div>
	</div>`;
}
