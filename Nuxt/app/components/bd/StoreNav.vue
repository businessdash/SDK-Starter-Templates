<!-- [bd-file:store] -->
<script setup lang="ts">
/**
 * The store's own links, with the cart count and how many products are
 * saved or picked to compare. The cart count comes from the server and is
 * shared through `useState("bd-cart-count")`, so adding to the cart updates
 * it; the saved lists live in this browser, so their counts arrive after load.
 */
import { onBeforeUnmount, onMounted, ref } from "vue";
import type { CartSnapshot } from "@businessdash/sdk/contracts";
import { compareList, wishlist } from "#shared/bd/shop";

const cartCount = useState<number>("bd-cart-count", () => 0);
const { data } = await useFetch<{ cart: CartSnapshot | null }>("/api/bd/cart", {
	key: "bd-store-nav-cart",
});
cartCount.value = data.value?.cart?.itemCount ?? cartCount.value;

const saved = ref(0);
const comparing = ref(0);
let stop: (() => void)[] = [];
onMounted(() => {
	saved.value = wishlist.read().length;
	comparing.value = compareList.read().length;
	stop = [
		wishlist.subscribe((items) => {
			saved.value = items.length;
		}),
		compareList.subscribe((items) => {
			comparing.value = items.length;
		}),
	];
});
onBeforeUnmount(() => stop.forEach((off) => off()));
</script>

<template>
	<nav class="store-nav" aria-label="Store">
		<div class="store-nav__links">
			<NuxtLink to="/store">Products</NuxtLink>
			<!-- [bd:subscriptions] -->
			<NuxtLink to="/subscriptions">Subscriptions</NuxtLink>
			<!-- [/bd:subscriptions] -->
		</div>
		<div class="store-nav__links">
			<NuxtLink to="/store/wishlist">
				Wishlist
				<span v-if="saved > 0" class="store-nav__count">{{ saved }}</span>
			</NuxtLink>
			<NuxtLink to="/store/compare">
				Compare
				<span v-if="comparing > 0" class="store-nav__count">{{ comparing }}</span>
			</NuxtLink>
			<NuxtLink class="store-nav__cart" to="/cart">
				Cart
				<span v-if="cartCount > 0" class="store-nav__badge">{{ cartCount }}</span>
			</NuxtLink>
		</div>
	</nav>
</template>
