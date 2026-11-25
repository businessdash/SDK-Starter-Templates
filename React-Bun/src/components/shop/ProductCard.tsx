// [bd-file:store]
import { Link } from "../../lib/router";
import { SaveButtons } from "./SaveButtons";
import { StarRating } from "./StarRating";
import { formatCents } from "./shop";

/** What a store card shows of a product (an item of `listProductsWithMeta`). */
export type ProductCardData = {
	id: string;
	name: string;
	coverImage: string | null;
	cheapestPriceCents: number | null;
	comparePriceCents: number | null;
	hasMultipleVariants: boolean;
	avgRating: number;
	reviewCount: number;
	isBestSeller: boolean;
	isNew: boolean;
	isOnSale: boolean;
	isLowStock: boolean;
};

/**
 * A product in the store's grid: its photo and badges (Best seller, New,
 * Sale), name, stars, price ("From" when options change it, the old price
 * on sale), Low stock, and ♡ / ⇄ to save it or pick it to compare.
 */
export function ProductCard({ product: p }: { product: ProductCardData }) {
	return (
		<div className="bd-card product-card">
			<Link className="product-card__link" to={`/store/${p.id}`}>
				<div className="product-card__media">
					{p.coverImage ? (
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
						{p.isBestSeller ? <span className="bd-badge">Best seller</span> : null}
						{p.isNew ? <span className="bd-badge">New</span> : null}
						{p.isOnSale ? <span className="bd-badge product-card__badge--sale">Sale</span> : null}
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
							{p.cheapestPriceCents != null
								? `${p.hasMultipleVariants ? "From " : ""}${formatCents(p.cheapestPriceCents)}`
								: "View details"}
						</span>
						{p.isOnSale && p.comparePriceCents != null ? (
							<span className="product-card__compare">{formatCents(p.comparePriceCents)}</span>
						) : null}
					</div>
					{p.isLowStock ? <span className="product-card__lowstock">Low stock</span> : null}
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
