<!-- [bd-file:store] -->
<script setup lang="ts">
import { ref, watch } from "vue";
import BdHeader from "~/components/bd/BdHeader.vue";
import StoreNav from "~/components/bd/StoreNav.vue";
import BdFooter from "~/components/bd/BdFooter.vue";
import CartActions from "~/components/bd/shop/CartActions.vue";
import CartLine from "~/components/bd/shop/CartLine.vue";
import CartSummary from "~/components/bd/shop/CartSummary.vue";
import CouponForm from "~/components/bd/shop/CouponForm.vue";
import { useCart } from "~/composables/useCart";

/**
 * Cart page. Loads the visitor's cart, edits line quantities, applies /
 * removes a coupon, clears the cart, and starts Stripe-hosted checkout.
 * All mutations go through Nitro endpoints — the SDK + API key never
 * reach the browser. The page is laid out from the shop's parts in
 * `components/bd/shop/`: a cart line per item, the coupon, the subtotal, and
 * Clear cart / Checkout.
 */
const {
	cart,
	error,
	busy,
	load,
	updateItem,
	removeItem,
	applyCoupon,
	removeCoupon,
	clear,
} = useCart();

// Load on the server during SSR so the cart is present on first paint.
await useAsyncData("cart", load);

// Keep the cart count in the store links in step with edits made here.
const cartCount = useState<number>("bd-cart-count", () => 0);
watch(
	() => cart.value?.itemCount,
	(count) => {
		if (count !== undefined) cartCount.value = count;
	},
);

const checkoutError = ref<string | null>(null);
const checkingOut = ref(false);

async function handleCheckout() {
	checkingOut.value = true;
	checkoutError.value = null;
	try {
		const res = await $fetch<
			{ ok: true; url: string } | { ok: false; error: string }
		>("/api/bd/checkout/start", { method: "POST" });
		if (res.ok) {
			window.location.href = res.url;
		} else {
			checkoutError.value = res.error;
		}
	} catch (err) {
		checkoutError.value =
			err instanceof Error ? err.message : "Couldn't start checkout.";
	} finally {
		checkingOut.value = false;
	}
}

useHead({ title: "Cart — Your Business" });
</script>

<template>
	<div>
		<BdHeader />
		<StoreNav />
		<main>
			<section class="bd-section bd-section--narrow">
				<div class="bd-section__lead">
					<span class="bd-section__eyebrow">Checkout</span>
					<h1 class="bd-section__title">Your cart</h1>
				</div>

				<div v-if="!cart || cart.items.length === 0" class="bd-empty">
					Your cart is empty. <NuxtLink to="/store">Browse the store →</NuxtLink>
				</div>

				<div v-else class="bd-card cart">
					<CartLine
						v-for="item in cart.items"
						:key="item.id"
						:item="item"
						:currency="cart.currency"
						:busy="busy"
						@quantity="(quantity) => updateItem(item.id, quantity)"
						@remove="removeItem(item.id)"
					/>
					<CouponForm
						:code="cart.couponCode"
						:busy="busy"
						:apply="applyCoupon"
						@remove="removeCoupon"
					/>
					<CartSummary :subtotal="cart.subtotal" :currency="cart.currency" />
					<CartActions
						:busy="busy"
						:checking-out="checkingOut"
						@clear="clear"
						@checkout="handleCheckout"
					/>

					<div
						v-if="error || checkoutError"
						style="
							color: var(--danger);
							background: var(--danger-bg);
							padding: 0.75rem 1rem;
							border-radius: 0.5rem;
							font-size: 0.9rem;
						"
					>
						{{ error ?? checkoutError }}
					</div>
				</div>
			</section>
		</main>
		<BdFooter />
	</div>
</template>
