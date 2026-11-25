<!-- [bd-file:store] -->
<script setup lang="ts">
/** A row of small product cards: related products, recently viewed. */
import { formatCents, type SavedProduct } from "#shared/bd/shop";

defineProps<{ title: string; products: SavedProduct[] }>();
</script>

<template>
	<section v-if="products.length > 0" class="product-rail">
		<h2 class="product-rail__title">{{ title }}</h2>
		<ul class="product-rail__row">
			<li v-for="product in products" :key="product.id">
				<NuxtLink class="bd-card product-rail__card" :to="`/store/${product.id}`">
					<img
						v-if="product.image"
						:src="product.image"
						alt=""
						loading="lazy"
						referrerpolicy="no-referrer"
					/>
					<span v-else class="product-rail__noimg" aria-hidden="true" />
					<span class="product-rail__name">{{ product.name }}</span>
					<span v-if="product.priceCents != null" class="product-rail__price">
						{{ formatCents(product.priceCents) }}
					</span>
				</NuxtLink>
			</li>
		</ul>
	</section>
</template>
