<script setup lang="ts">
import { computed, ref } from "vue";
import BdHeader from "~/components/bd/BdHeader.vue";
import BdFooter from "~/components/bd/BdFooter.vue";
import { useCart } from "~/composables/useCart";
import type { StoreProductResult } from "../../../server/api/bd/store/product/[id].get";

/**
 * Product detail. Server-renders the product (via the Nitro endpoint),
 * lets the visitor pick a variant if the product has any, and adds it
 * to the visitor-token cart through `useCart`.
 */
const route = useRoute();
const id = route.params.id as string;

const { data } = await useFetch<StoreProductResult>(
	`/api/bd/store/product/${id}`,
);
const product = computed(() => data.value?.product ?? null);

// Variants are loosely typed (`Record<string, unknown>[]`). Pull the
// fields we display defensively.
type LooseVariant = Record<string, unknown>;
const variants = computed<LooseVariant[]>(() =>
	Array.isArray(product.value?.variants) ? product.value.variants : [],
);
const selectedVariantId = ref<string | null>(
	variants.value.length > 0
		? (variants.value[0]?.id as string | undefined) ?? null
		: null,
);

function variantLabel(v: LooseVariant): string {
	return (
		(v.title as string) ?? (v.name as string) ?? (v.id as string) ?? "Variant"
	);
}

const { addItem, error, busy } = useCart();
const added = ref(false);

async function handleAdd() {
	if (!product.value) return;
	added.value = false;
	const ok = await addItem({
		productId: product.value.id,
		variantId: selectedVariantId.value,
		quantity: 1,
	});
	if (ok) added.value = true;
}

useHead(() => ({ title: product.value?.name ?? "Product — Your Business" }));
</script>

<template>
	<div>
		<BdHeader />
		<main>
			<section class="bd-section bd-section--narrow">
				<p class="store-links">
					<NuxtLink to="/store">← Back to store</NuxtLink>
				</p>

				<div v-if="data?.suspended" class="bd-empty">
					The store is temporarily unavailable. Please check back soon.
				</div>
				<div v-else-if="!product" class="bd-empty">
					This product couldn't be found.
				</div>
				<div v-else class="bd-card product-detail">
					<img
						v-if="product.images && product.images.length"
						:alt="product.name"
						class="product-detail__img"
						:src="product.images[0]"
					/>
					<h1>{{ product.name }}</h1>

					<div v-if="variants.length" class="product-detail__variants">
						<label class="bd-label" for="variant">Option</label>
						<select
							id="variant"
							v-model="selectedVariantId"
							class="bd-select"
						>
							<option
								v-for="v in variants"
								:key="(v.id as string) ?? variantLabel(v)"
								:value="v.id as string"
							>
								{{ variantLabel(v) }}
							</option>
						</select>
					</div>

					<button
						class="bd-btn"
						:disabled="busy"
						style="align-self: flex-start"
						type="button"
						@click="handleAdd"
					>
						{{ busy ? "Adding…" : "Add to cart" }}
					</button>

					<p v-if="added" class="product-detail__added">
						Added to cart. <NuxtLink to="/cart">View cart →</NuxtLink>
					</p>
					<div
						v-if="error"
						style="
							color: var(--danger);
							background: var(--danger-bg);
							padding: 0.75rem 1rem;
							border-radius: 0.5rem;
							font-size: 0.9rem;
						"
					>
						{{ error }}
					</div>
				</div>
			</section>
		</main>
		<BdFooter />
	</div>
</template>
