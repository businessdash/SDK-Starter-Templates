<!-- [bd-file:store] -->
<script setup lang="ts">
/** "Complete your purchase": add-ons, each with Add; the store bar's count follows. */
import { ref } from "vue";
import { useCart } from "~/composables/useCart";
import { formatCents } from "#shared/bd/shop";
import type { StoreProductResult } from "../../../../server/api/bd/store/product/[id].get";

type Addon = StoreProductResult["addons"][number];

defineProps<{ addons: Addon[] }>();

const adding = ref<string | null>(null);
const added = ref<Record<string, boolean>>({});
const cartCount = useState<number>("bd-cart-count", () => 0);
const { addItem, cart } = useCart();

async function add(addon: Addon) {
	adding.value = addon.id;
	const first = (Array.isArray(addon.variants) ? addon.variants[0] : undefined) as
		| { variantId?: unknown; id?: unknown }
		| undefined;
	const variant = first?.variantId ?? first?.id;
	const ok = await addItem({
		productId: addon.addonProductId,
		variantId: typeof variant === "string" ? variant : null,
		quantity: 1,
	});
	adding.value = null;
	if (ok) {
		cartCount.value = cart.value?.itemCount ?? cartCount.value + 1;
		added.value = { ...added.value, [addon.id]: true };
	}
}
</script>

<template>
	<section v-if="addons.length" class="product-section">
		<h2 class="product-section__title">Complete your purchase</h2>
		<div class="addon-grid">
			<div v-for="addon in addons" :key="addon.id" class="addon-card bd-card">
				<div class="addon-card__media">
					<img
						v-if="addon.imageUrl"
						:src="addon.imageUrl"
						:alt="addon.addonName"
						loading="lazy"
						referrerpolicy="no-referrer"
					/>
					<div v-else class="addon-card__noimg">—</div>
				</div>
				<div class="addon-card__body">
					<span v-if="addon.groupLabel" class="addon-card__group">
						{{ addon.groupLabel }}
					</span>
					<p class="addon-card__name">{{ addon.addonName }}</p>
					<span v-if="addon.priceCents != null" class="addon-card__price">
						{{ formatCents(addon.priceCents) }}
					</span>
				</div>
				<button
					type="button"
					class="bd-btn bd-btn--ghost addon-card__add"
					:disabled="adding === addon.id || added[addon.id]"
					@click="add(addon)"
				>
					{{ added[addon.id] ? "Added" : adding === addon.id ? "…" : "Add" }}
				</button>
			</div>
		</div>
	</section>
</template>
