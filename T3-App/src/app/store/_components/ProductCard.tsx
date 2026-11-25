// [bd-file:store]
import Link from "next/link";

import { SaveButtons } from "@/app/_components/bd/shop/SaveButtons";
import { StarRating } from "@/app/_components/bd/shop/StarRating";

import type { StoreCard } from "./StoreView";

/** "$42" for whole dollars, "$42.50" otherwise, "—" for no price. */
export function priceLabel(cents: number | null): string {
	if (cents == null) return "—";
	const dollars = cents / 100;
	try {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: dollars % 1 === 0 ? 0 : 2,
		}).format(dollars);
	} catch {
		return `$${dollars.toFixed(2)}`;
	}
}

/**
 * A product in the store's grid: its photo and badges (Best seller, New,
 * Sale), name, stars, price ("From" when options change it, the old price
 * on sale), Low stock, and ♡ / ⇄ to save it or pick it to compare.
 */
export function ProductCard({ product: p }: { product: StoreCard }) {
	return (
		<div className="bd-card product-card">
			<Link className="product-card__link" href={`/store/${p.id}`}>
				<div className="product-card__media">
					{p.coverImage ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img
							alt={p.name}
							className="product-card__img"
							loading="lazy"
							referrerPolicy="no-referrer"
							src={p.coverImage}
						/>
					) : (
						<div className="product-card__noimg">No image</div>
					)}
					<div className="product-card__badges">
						{p.isBestSeller ? (
							<span className="bd-badge">Best seller</span>
						) : null}
						{p.isNew ? <span className="bd-badge">New</span> : null}
						{p.isOnSale ? (
							<span className="bd-badge product-card__badge--sale">Sale</span>
						) : null}
					</div>
				</div>
				<div className="product-card__body">
					<h3>{p.name || "Untitled"}</h3>
					{p.reviewCount > 0 ? (
						<div className="product-card__rating">
							<StarRating rating={p.avgRating} />
							<span className="product-card__count">({p.reviewCount})</span>
						</div>
					) : null}
					<div className="product-card__price">
						<span className="product-card__amount">
							{p.hasMultipleVariants ? "From " : ""}
							{priceLabel(p.cheapestPriceCents)}
						</span>
						{p.isOnSale && p.comparePriceCents != null ? (
							<span className="product-card__compare">
								{priceLabel(p.comparePriceCents)}
							</span>
						) : null}
					</div>
					{p.isLowStock ? (
						<span className="product-card__lowstock">Low stock</span>
					) : null}
				</div>
			</Link>
			<div className="product-card__save">
				<SaveButtons
					compact
					product={{
						id: p.id,
						name: p.name,
						image: p.coverImage,
						priceCents: p.cheapestPriceCents,
					}}
				/>
			</div>
		</div>
	);
}
