<!-- [bd-file:store] -->
<script setup lang="ts">
import { computed } from "vue";
import BdFooter from "~/components/bd/BdFooter.vue";
import BdHeader from "~/components/bd/BdHeader.vue";
import ProductDetail from "~/components/bd/shop/ProductDetail.vue";
import StoreNav from "~/components/bd/StoreNav.vue";
import { defaultVariant, galleryFor, toProductView } from "#shared/bd/shop";
import type { StoreProductResult } from "../../../server/api/bd/store/product/[id].get";

/**
 * Product page, laid out by `ProductDetail` from the shop's parts in
 * `components/bd/shop/`: photos that follow the chosen option, option and
 * size buttons, the price for what's chosen, add to cart, save and compare,
 * share, details, add-ons, reviews with "Show more" (`?reviews=20`), related
 * products and what was viewed before. Shop logic is in `#shared/bd/shop`.
 */
const route = useRoute();
const id = computed(() => String(route.params.id));
const reviewLimit = computed(() => route.query.reviews ?? undefined);

const { data } = await useFetch<StoreProductResult>(
	() => `/api/bd/store/product/${id.value}`,
	{ query: computed(() => (reviewLimit.value ? { reviews: reviewLimit.value } : {})) },
);
if (data.value && !data.value.product && !data.value.suspended) {
	throw createError({ statusCode: 404, statusMessage: "Product not found", fatal: true });
}

const product = computed(() => (data.value?.product as Record<string, unknown> | null) ?? null);
const view = computed(() => (product.value ? toProductView(product.value) : null));
const moreReviewsTo = computed(() =>
	data.value?.reviews && data.value.reviews.totalCount > data.value.reviews.items.length
		? { query: { reviews: (data.value.reviewLimit ?? 10) + 10 }, hash: "#reviews" }
		: null,
);
const cover = computed(() =>
	view.value ? galleryFor(view.value, defaultVariant(view.value)?.id ?? "")[0] : undefined,
);

useHead(() => ({
	title: view.value ? `${view.value.name} — Your Business` : "Product — Your Business",
	meta: [
		...(view.value?.description
			? [{ name: "description", content: view.value.description.slice(0, 160) }]
			: []),
		...(cover.value ? [{ property: "og:image", content: cover.value }] : []),
	],
}));
</script>

<template>
	<div>
		<BdHeader />
		<StoreNav />
		<main class="bd-section">
			<div v-if="data?.suspended" class="bd-empty">
				The store is temporarily unavailable. Please check back soon.
			</div>
			<ProductDetail
				v-else-if="data && product"
				:product="product"
				:reviews="data.reviews"
				:addons="data.addons"
				:related="data.related"
				:more-reviews-to="moreReviewsTo"
			/>
		</main>
		<BdFooter />
	</div>
</template>
