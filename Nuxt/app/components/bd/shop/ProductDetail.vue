<!-- [bd-file:store] -->
<script setup lang="ts">
/**
 * The whole product page: photos that follow the chosen option, option and
 * size buttons, the price for what's chosen, add to cart (the options travel
 * with the cart line), save and compare, share, details, add-ons, reviews,
 * related products and what was viewed before.
 *
 * It holds what's chosen and lays the page out from the parts imported
 * below, one file each, so you can move, restyle or drop any part, or lay
 * them out your own way.
 */
import { computed, ref, watch } from "vue";
import type { RouteLocationRaw } from "vue-router";
import CompareBar from "~/components/bd/CompareBar.vue";
import ProductRail from "~/components/bd/ProductRail.vue";
import SaveButtons from "~/components/bd/SaveButtons.vue";
import { useCart } from "~/composables/useCart";
import {
	chosenOptions,
	defaultVariant,
	galleryFor,
	optionGroupsFor,
	priceFor,
	type SavedProduct,
	toProductView,
} from "#shared/bd/shop";
import type { StoreProductResult } from "../../../../server/api/bd/store/product/[id].get";
import AddToCartButton from "./AddToCartButton.vue";
import CartNotice from "./CartNotice.vue";
import OptionPicker from "./OptionPicker.vue";
import ProductAddons from "./ProductAddons.vue";
import ProductBreadcrumbs from "./ProductBreadcrumbs.vue";
import ProductGallery from "./ProductGallery.vue";
import ProductPolicies from "./ProductPolicies.vue";
import ProductPrice from "./ProductPrice.vue";
import ProductReviews from "./ProductReviews.vue";
import ProductSpecs from "./ProductSpecs.vue";
import ProductTitle from "./ProductTitle.vue";
import QuantityStepper from "./QuantityStepper.vue";
import RecentlyViewed from "./RecentlyViewed.vue";
import ShareButton from "./ShareButton.vue";
import StockNote from "./StockNote.vue";
import VariantPicker from "./VariantPicker.vue";

const props = withDefaults(
	defineProps<{
		product: Record<string, unknown>;
		reviews: StoreProductResult["reviews"];
		addons: StoreProductResult["addons"];
		related: StoreProductResult["related"];
		moreReviewsTo?: RouteLocationRaw | null;
		storeHref?: string;
		cartHref?: string;
		contactHref?: string;
	}>(),
	{ moreReviewsTo: null, storeHref: "/store", cartHref: "/cart", contactHref: "/#contact" },
);

const view = computed(() => toProductView(props.product));

const variantId = ref("");
const chosen = ref<Record<string, string>>({});
const photo = ref(0);
const quantity = ref(1);
const message = ref<{ kind: "ok" | "error"; text: string } | null>(null);
const cartCount = useState<number>("bd-cart-count", () => 0);
const { addItem, busy, error, cart } = useCart();

// A new product (following a related link) starts over.
watch(
	() => view.value.id,
	() => {
		variantId.value = defaultVariant(view.value)?.id ?? "";
		chosen.value = {};
		photo.value = 0;
		quantity.value = 1;
		message.value = null;
	},
	{ immediate: true },
);

const gallery = computed(() => galleryFor(view.value, variantId.value));
const groups = computed(() => optionGroupsFor(view.value, variantId.value));
const price = computed(() => priceFor(view.value, variantId.value, chosen.value));
const summary = computed<SavedProduct>(() => {
	const dollars = price.value.amount ?? view.value.variants[0]?.price ?? null;
	return {
		id: view.value.id,
		name: view.value.name,
		image: view.value.images[0] ?? null,
		priceCents: dollars != null ? Math.round(dollars * 100) : null,
	};
});
const relatedCards = computed<SavedProduct[]>(() =>
	props.related.map((rp) => ({
		id: rp.id,
		name: rp.name,
		image: rp.coverImageUrl,
		priceCents: rp.minPriceDollars != null ? Math.round(rp.minPriceDollars * 100) : null,
	})),
);

function pickVariant(next: string) {
	variantId.value = next;
	chosen.value = {};
	photo.value = 0;
}

async function handleAdd() {
	if (!price.value.ready) return;
	message.value = null;
	const ok = await addItem({
		productId: view.value.id,
		variantId: variantId.value || null,
		quantity: quantity.value,
		options: chosenOptions(view.value, variantId.value, chosen.value),
	});
	if (ok) {
		cartCount.value = cart.value?.itemCount ?? cartCount.value + quantity.value;
		message.value = { kind: "ok", text: `Added ${quantity.value} to your cart.` };
	} else {
		message.value = { kind: "error", text: error.value ?? "Couldn't add that. Try again." };
	}
}
</script>

<template>
	<ProductBreadcrumbs :product="view" :store-href="storeHref" />

	<div class="product-detail">
		<ProductGallery v-model:photo="photo" :photos="gallery" :name="view.name" />

		<div class="product-detail__info bd-card">
			<ProductTitle :product="view" :reviews="reviews" />
			<ProductPrice :price="price" :quantity="quantity" />

			<p v-if="view.description" class="product-detail__desc">
				{{ view.description }}
			</p>

			<VariantPicker
				:variants="view.variants"
				:selected="variantId"
				:show-prices="groups.length === 0"
				@pick="pickVariant"
			/>
			<OptionPicker
				v-for="group in groups"
				:key="group.id"
				:group="group"
				:chosen="chosen[group.id]"
				@pick="(valueId) => (chosen = { ...chosen, [group.id]: valueId })"
			/>
			<StockNote :stock="price.stock" />

			<div class="buy">
				<QuantityStepper v-model="quantity" :max="price.stock" />
				<AddToCartButton :price="price" :busy="busy" @add="handleAdd" />
			</div>
			<CartNotice :message="message" :cart-href="cartHref" />

			<div class="product-detail__tools">
				<SaveButtons :product="summary" />
				<ShareButton :title="view.name" />
			</div>
			<ProductPolicies :contact-href="contactHref" />
		</div>
	</div>

	<ProductSpecs :features="view.features" :specs="view.specs" />
	<ProductAddons :addons="addons" />
	<ProductReviews :reviews="reviews" :more-to="moreReviewsTo" />
	<ProductRail title="You may also like" :products="relatedCards" />
	<RecentlyViewed :key="view.id" :product="summary" />
	<CompareBar />
</template>
