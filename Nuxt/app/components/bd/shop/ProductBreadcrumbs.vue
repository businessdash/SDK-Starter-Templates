<!-- [bd-file:store] -->
<script setup lang="ts">
/** Store / Category / This product. */
import type { ProductView } from "#shared/bd/shop";

withDefaults(defineProps<{ product: ProductView; storeHref?: string }>(), { storeHref: "/store" });
</script>

<template>
	<nav class="crumbs" aria-label="Breadcrumb">
		<NuxtLink :to="storeHref">Store</NuxtLink>
		<template v-if="product.categoryId">
			<span aria-hidden="true">/</span>
			<NuxtLink :to="`${storeHref}?category=${product.categoryId}`">
				{{ product.categoryName ?? "Category" }}
			</NuxtLink>
		</template>
		<span aria-hidden="true">/</span>
		<span aria-current="page">{{ product.name }}</span>
	</nav>
</template>
