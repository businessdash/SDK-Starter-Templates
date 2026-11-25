// [bd-file:store]
import type { StorefrontProductCard } from "@businessdash/sdk/contracts";
import { Link } from "@tanstack/solid-router";
import { Show } from "solid-js";

import { formatMoney } from "../money";
import { ShopStars } from "../ShopStars";
import { SaveButtons } from "./SaveButtons";

/**
 * A product in the store's grid: its photo and badges (Best seller, New,
 * Sale), name, stars, price ("From" when options change it, the old price
 * on sale), Low stock, and ♡ / ⇄ to save it or pick it to compare.
 */
export function ProductCard(props: { product: StorefrontProductCard }) {
	const p = () => props.product;
	return (
		<div class="bd-card product-card">
			<Link class="product-card__link" params={{ id: p().id }} to="/store/$id">
				<div class="product-card__media">
					<Show
						when={p().coverImage}
						fallback={<div class="product-card__noimg">No image</div>}
					>
						<img
							alt={p().name}
							class="product-card__img"
							loading="lazy"
							referrerpolicy="no-referrer"
							src={p().coverImage ?? ""}
						/>
					</Show>
					<div class="product-card__badges">
						<Show when={p().isBestSeller}>
							<span class="bd-badge">Best seller</span>
						</Show>
						<Show when={p().isNew}>
							<span class="bd-badge">New</span>
						</Show>
						<Show when={p().isOnSale}>
							<span class="bd-badge product-card__badge--sale">Sale</span>
						</Show>
					</div>
				</div>
				<div class="product-card__body">
					<h3>{p().name || "Untitled"}</h3>
					<Show when={p().reviewCount > 0}>
						<div class="product-card__rating">
							<ShopStars rating={p().avgRating} />
							<span class="product-card__count">({p().reviewCount})</span>
						</div>
					</Show>
					<div class="product-card__price">
						<span class="product-card__amount">
							{p().cheapestPriceCents != null
								? `${p().hasMultipleVariants ? "From " : ""}${formatMoney(p().cheapestPriceCents ?? 0)}`
								: "View details"}
						</span>
						<Show when={p().isOnSale && p().comparePriceCents != null}>
							<span class="product-card__compare">
								{formatMoney(p().comparePriceCents ?? 0)}
							</span>
						</Show>
					</div>
					<Show when={p().isLowStock}>
						<span class="product-card__lowstock">Low stock</span>
					</Show>
				</div>
			</Link>
			<div class="product-card__save">
				<SaveButtons
					compact
					product={{
						id: p().id,
						name: p().name,
						image: p().coverImage ?? null,
						priceCents: p().cheapestPriceCents ?? null,
					}}
				/>
			</div>
		</div>
	);
}
