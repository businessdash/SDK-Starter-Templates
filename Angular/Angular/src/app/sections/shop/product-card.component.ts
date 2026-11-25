// [bd-file:store]
import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, computed, input } from "@angular/core";
import { RouterLink } from "@angular/router";
import type { ProductCard } from "../../lib/bd-api.client";
import type { SavedProduct } from "../../shop/shop";
import { StarRatingComponent } from "../star-rating.component";
import { SaveButtonsDirective } from "./save-buttons.directive";

/** Product prices are cents. */
function money(cents: number): string {
	return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

/**
 * A product in the store's grid: its photo and badges (Best seller, New,
 * Sale), name, stars, price ("From" when options change it, the old price
 * on sale), Low stock, and ♡ / ⇄ to save it or pick it to compare.
 */
@Component({
	selector: "bd-product-card",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [RouterLink, SaveButtonsDirective, StarRatingComponent],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	styles: ":host { display: contents; }",
	template: `
		@let p = product();
		<div class="bd-card product-card">
			<a class="product-card__link" [routerLink]="[storeHref(), p.id]">
				<div class="product-card__media">
					@if (p.coverImage) {
						<img class="product-card__img" loading="lazy" referrerpolicy="no-referrer" [alt]="p.name" [src]="p.coverImage" />
					} @else {
						<div class="product-card__noimg">No image</div>
					}
					<div class="product-card__badges">
						@if (p.isBestSeller) {
							<span class="bd-badge">Best seller</span>
						}
						@if (p.isNew) {
							<span class="bd-badge">New</span>
						}
						@if (p.isOnSale) {
							<span class="bd-badge product-card__badge--sale">Sale</span>
						}
					</div>
				</div>
				<div class="product-card__body">
					<h3>{{ p.name || "Untitled" }}</h3>
					@if (p.reviewCount > 0) {
						<div class="product-card__rating">
							<bd-star-rating [rating]="p.avgRating" />
							<span class="product-card__count">({{ p.reviewCount }})</span>
						</div>
					}
					<div class="product-card__price">
						<span class="product-card__amount">{{ priceLabel() }}</span>
						@if (p.isOnSale && p.comparePriceCents != null) {
							<span class="product-card__compare">{{ money(p.comparePriceCents) }}</span>
						}
					</div>
					@if (p.isLowStock) {
						<span class="product-card__lowstock">Low stock</span>
					}
				</div>
			</a>
			<div class="product-card__save">
				<bd-save-buttons compact [product]="saved()" />
			</div>
		</div>
	`,
})
export class ProductCardComponent {
	readonly product = input.required<ProductCard>();
	readonly storeHref = input("/store");
	readonly money = money;

	readonly priceLabel = computed(() => {
		const p = this.product();
		return p.cheapestPriceCents != null
			? `${p.hasMultipleVariants ? "From " : ""}${money(p.cheapestPriceCents)}`
			: "View details";
	});
	readonly saved = computed<SavedProduct>(() => {
		const p = this.product();
		return { id: p.id, name: p.name, image: p.coverImage ?? null, priceCents: p.cheapestPriceCents ?? null };
	});
}
