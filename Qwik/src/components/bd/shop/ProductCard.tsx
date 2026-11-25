// [bd-file:store]
import { Link } from "@builder.io/qwik-city";

import type { StorefrontProductCard } from "@businessdash/sdk/contracts";

import { formatMoney } from "../../../lib/bd-store";
import { ShopStars } from "../ShopStars";
import { SaveButtons } from "./SaveButtons";

/**
 * A product in the store's grid: its photo and badges (Best seller, New,
 * Sale), name, stars, price ("From" when options change it, the old price
 * on sale), Low stock, and ♡ / ⇄ to save it or pick it to compare.
 */
export function ProductCard({ product: p, storeHref = "/store" }: { product: StorefrontProductCard; storeHref?: string }) {
	return (
		<div class="bd-card product-card">
			<Link class="product-card__link" href={`${storeHref}/${p.id}`}>
				<div class="product-card__media">
					{p.coverImage ? (
						<img alt={p.name} class="product-card__img" loading="lazy" referrerPolicy="no-referrer" src={p.coverImage} />
					) : (
						<div class="product-card__noimg">No image</div>
					)}
					<div class="product-card__badges">
						{p.isBestSeller ? <span class="bd-badge">Best seller</span> : null}
						{p.isNew ? <span class="bd-badge">New</span> : null}
						{p.isOnSale ? <span class="bd-badge product-card__badge--sale">Sale</span> : null}
					</div>
				</div>
				<div class="product-card__body">
					<h3>{p.name || "Untitled"}</h3>
					{p.reviewCount > 0 ? (
						<div class="product-card__rating">
							<ShopStars rating={p.avgRating} />
							<span class="product-card__count">({p.reviewCount})</span>
						</div>
					) : null}
					<div class="product-card__price">
						<span class="product-card__amount">
							{p.cheapestPriceCents != null
								? `${p.hasMultipleVariants ? "From " : ""}${formatMoney(p.cheapestPriceCents, "usd")}`
								: "View details"}
						</span>
						{p.isOnSale && p.comparePriceCents != null ? (
							<span class="product-card__compare">{formatMoney(p.comparePriceCents, "usd")}</span>
						) : null}
					</div>
					{p.isLowStock ? <span class="product-card__lowstock">Low stock</span> : null}
				</div>
			</Link>
			<div class="product-card__save">
				<SaveButtons
					compact
					product={{ id: p.id, name: p.name, image: p.coverImage ?? null, priceCents: p.cheapestPriceCents ?? null }}
				/>
			</div>
		</div>
	);
}
