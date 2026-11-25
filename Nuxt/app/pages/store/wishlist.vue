<!-- [bd-file:store] -->
<script setup lang="ts">
/** The wishlist: products saved on this device, to open and buy later. */
import { onBeforeUnmount, onMounted, ref } from "vue";
import BdFooter from "~/components/bd/BdFooter.vue";
import BdHeader from "~/components/bd/BdHeader.vue";
import StoreNav from "~/components/bd/StoreNav.vue";
import { formatCents, type SavedProduct, wishlist } from "#shared/bd/shop";

const items = ref<SavedProduct[]>([]);
const ready = ref(false);
let off = () => {};
onMounted(() => {
	items.value = wishlist.read();
	ready.value = true;
	off = wishlist.subscribe((next) => {
		items.value = next;
	});
});
onBeforeUnmount(() => off());

useHead({ title: "Wishlist — Your Business" });
</script>

<template>
	<div>
		<BdHeader />
		<StoreNav />
		<main class="bd-section">
			<div class="bd-section__lead">
				<h1 class="bd-section__title">Wishlist</h1>
				<p class="bd-section__sub">
					Saved on this device. Open a product to choose options and buy.
				</p>
			</div>

			<p v-if="!ready" class="bd-loading">Loading…</p>
			<div v-else-if="items.length === 0" class="bd-empty">
				Nothing saved yet. Press <span aria-hidden="true">♡</span> Save on any product.
				<p><NuxtLink class="bd-btn" to="/store">Browse products</NuxtLink></p>
			</div>
			<template v-else>
				<ul class="wishlist bd-grid-4">
					<li v-for="item in items" :key="item.id" class="bd-card wishlist__card">
						<NuxtLink :to="`/store/${item.id}`" class="wishlist__link">
							<img
								v-if="item.image"
								:src="item.image"
								alt=""
								loading="lazy"
								referrerpolicy="no-referrer"
							/>
							<span v-else class="wishlist__noimg" aria-hidden="true" />
							<span class="wishlist__name">{{ item.name }}</span>
							<span v-if="item.priceCents != null" class="wishlist__price">
								{{ formatCents(item.priceCents) }}
							</span>
						</NuxtLink>
						<button type="button" class="bd-btn bd-btn--ghost" @click="wishlist.remove(item.id)">
							Remove
						</button>
					</li>
				</ul>
				<p class="wishlist__clear">
					<button type="button" class="bd-btn bd-btn--ghost" @click="wishlist.clear()">
						Clear the wishlist
					</button>
				</p>
			</template>
		</main>
		<BdFooter />
	</div>
</template>
