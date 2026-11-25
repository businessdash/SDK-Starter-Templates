<!-- [bd-file:store] -->
<script setup lang="ts">
/**
 * A product in the store's grid: its photo and badges (Best seller, New,
 * Sale), name, stars, price ("From" when options change it, the old price
 * on sale), Low stock, and ♡ / ⇄ to save it or pick it to compare.
 */
import SaveButtons from "~/components/bd/SaveButtons.vue";
import StarRating from "~/components/bd/StarRating.vue";
import type { StoreProductsMetaResult } from "../../../../server/api/bd/store/products-meta.get";

withDefaults(
	defineProps<{ product: StoreProductsMetaResult["items"][number]; storeHref?: string }>(),
	{ storeHref: "/store" },
);

function priceLabel(cents: number | null): string {
	if (cents == null) return "—";
	const dollars = cents / 100;
	return `$${dollars.toLocaleString(undefined, {
		minimumFractionDigits: dollars % 1 === 0 ? 0 : 2,
		maximumFractionDigits: 2,
	})}`;
}
</script>

<template>
	<div class="bd-card product-card">
		<NuxtLink class="product-card__link" :to="`${storeHref}/${product.id}`">
			<div class="product-card__media">
				<img
					v-if="product.coverImage"
					class="product-card__img"
					:src="product.coverImage"
					:alt="product.name"
					loading="lazy"
					referrerpolicy="no-referrer"
				/>
				<div v-else class="product-card__noimg">No image</div>
				<div class="product-card__badges">
					<span v-if="product.isBestSeller" class="bd-badge">Best seller</span>
					<span v-if="product.isNew" class="bd-badge">New</span>
					<span v-if="product.isOnSale" class="bd-badge product-card__badge--sale">
						Sale
					</span>
				</div>
			</div>
			<div class="product-card__body">
				<h3>{{ product.name || "Untitled" }}</h3>
				<div v-if="product.reviewCount > 0" class="product-card__rating">
					<StarRating :rating="product.avgRating" />
					<span class="product-card__count">({{ product.reviewCount }})</span>
				</div>
				<div class="product-card__price">
					<span class="product-card__amount">
						{{ product.hasMultipleVariants ? "From " : ""
						}}{{ priceLabel(product.cheapestPriceCents) }}
					</span>
					<span
						v-if="product.isOnSale && product.comparePriceCents != null"
						class="product-card__compare"
					>
						{{ priceLabel(product.comparePriceCents) }}
					</span>
				</div>
				<span v-if="product.isLowStock" class="product-card__lowstock">
					Low stock
				</span>
			</div>
		</NuxtLink>
		<div class="product-card__save">
			<SaveButtons
				compact
				:product="{
					id: product.id,
					name: product.name,
					image: product.coverImage,
					priceCents: product.cheapestPriceCents,
				}"
			/>
		</div>
	</div>
</template>
