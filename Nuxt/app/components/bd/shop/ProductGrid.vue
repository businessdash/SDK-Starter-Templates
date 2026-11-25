<!-- [bd-file:store] -->
<script setup lang="ts">
/** The store's products, a product card each. */
import type { StoreProductsMetaResult } from "../../../../server/api/bd/store/products-meta.get";
import ProductCard from "./ProductCard.vue";

withDefaults(
	defineProps<{ products: StoreProductsMetaResult["items"]; storeHref?: string }>(),
	{ storeHref: "/store" },
);
</script>

<template>
	<div class="bd-grid-3">
		<ProductCard
			v-for="product in products"
			:key="product.id"
			:product="product"
			:store-href="storeHref"
		/>
	</div>
</template>
