<!-- [bd-file:store] -->
<script setup lang="ts">
/** The category, the name, and the stars linking to the reviews. */
import StarRating from "~/components/bd/StarRating.vue";
import type { ProductView } from "#shared/bd/shop";

defineProps<{
	product: ProductView;
	reviews?: { avgRating: number; totalCount: number } | null;
}>();
</script>

<template>
	<div>
		<p v-if="product.categoryName" class="product-detail__eyebrow">
			{{ product.categoryName }}
		</p>
		<h1>{{ product.name }}</h1>
		<a v-if="reviews && reviews.totalCount > 0" class="product-detail__rating" href="#reviews">
			<StarRating :rating="reviews.avgRating" />
			<span> {{ reviews.avgRating.toFixed(1) }} · {{ reviews.totalCount }} reviews </span>
		</a>
	</div>
</template>
