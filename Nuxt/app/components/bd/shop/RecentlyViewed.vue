<!-- [bd-file:store] -->
<script setup lang="ts">
/**
 * What this browser opened before, as a rail; this product joins the list
 * for next time. The list lives in this browser, so it shows once the page
 * is there.
 */
import { onMounted, ref } from "vue";
import ProductRail from "~/components/bd/ProductRail.vue";
import { recentlyViewed, type SavedProduct } from "#shared/bd/shop";

const props = defineProps<{ product: SavedProduct | null }>();
const recent = ref<SavedProduct[]>([]);

onMounted(() => {
	const product = props.product;
	if (!product) return;
	// Shown before this one is added, so the product isn't in its own list.
	recent.value = recentlyViewed.read().filter((item) => item.id !== product.id);
	recentlyViewed.add(product);
});
</script>

<template>
	<ProductRail title="Recently viewed" :products="recent" />
</template>
