<script setup lang="ts">
import BiabHeader from "~/components/biab/BiabHeader.vue";
import BiabFooter from "~/components/biab/BiabFooter.vue";
import type { StoreProductsResult } from "../../../server/api/biab/store/products.get";

/**
 * Storefront product list. `useFetch` runs `/api/biab/store/products`
 * server-side; the SDK call (and the API key) stay on the server. The
 * grid degrades to an empty state when BIAB is unconfigured and to a
 * "temporarily unavailable" notice when billing is suspended.
 */
const { data } = await useFetch<StoreProductsResult>("/api/biab/store/products");

function firstImage(images: string[] | null | undefined): string | null {
	return (Array.isArray(images) ? images[0] : null) ?? null;
}

useHead({ title: "Store — Your Business" });
</script>

<template>
	<div>
		<BiabHeader />
		<main>
			<section class="biab-section">
				<div class="biab-section__lead">
					<span class="biab-section__eyebrow">Shop</span>
					<h1 class="biab-section__title">Store</h1>
					<p class="biab-section__sub">
						Live products from the BIAB storefront surface. Add to cart, apply a
						coupon, and check out via Stripe.
					</p>
				</div>

				<div v-if="data?.suspended" class="biab-empty">
					The store is temporarily unavailable. Please check back soon.
				</div>
				<div v-else-if="!data || data.products.length === 0" class="biab-empty">
					No products yet. Add some in BIAB at Dashboard → Products and they'll
					appear here.
				</div>
				<div v-else class="biab-grid-3">
					<NuxtLink
						v-for="product in data.products"
						:key="product.id"
						class="biab-card product-card"
						:to="`/store/${product.id}`"
					>
						<div class="product-card__media">
							<img
								v-if="firstImage(product.images)"
								:alt="product.name"
								loading="lazy"
								:src="firstImage(product.images) ?? undefined"
							/>
							<div v-else class="product-card__placeholder">No image</div>
						</div>
						<h3>{{ product.name }}</h3>
					</NuxtLink>
				</div>

				<p class="store-links">
					<NuxtLink to="/cart">View cart →</NuxtLink>
					<NuxtLink to="/subscriptions">Subscriptions →</NuxtLink>
				</p>
			</section>
		</main>
		<BiabFooter />
	</div>
</template>
