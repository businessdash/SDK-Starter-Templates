<script setup lang="ts">
import { ref } from "vue";
import BdHeader from "~/components/bd/BdHeader.vue";
import BdFooter from "~/components/bd/BdFooter.vue";
import { useCart, formatMoney } from "~/composables/useCart";

/**
 * Cart page. Loads the visitor's cart, edits line quantities, applies /
 * removes a coupon, clears the cart, and starts Stripe-hosted checkout.
 * All mutations go through Nitro endpoints — the SDK + API key never
 * reach the browser.
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

const couponInput = ref("");
const checkoutError = ref<string | null>(null);
const checkingOut = ref(false);

async function handleApplyCoupon() {
	if (!couponInput.value.trim()) return;
	const ok = await applyCoupon(couponInput.value.trim());
	if (ok) couponInput.value = "";
}

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
					<div v-for="item in cart.items" :key="item.id" class="cart-line">
						<img
							v-if="item.productImage"
							:alt="item.productName ?? 'Item'"
							class="cart-line__img"
							:src="item.productImage"
						/>
						<div class="cart-line__info">
							<div class="cart-line__name">{{ item.productName }}</div>
							<div v-if="item.variantTitle" class="cart-line__variant">
								{{ item.variantTitle }}
							</div>
							<div class="cart-line__price">
								{{ formatMoney(item.subtotal, cart.currency) }}
							</div>
						</div>
						<div class="cart-line__qty">
							<button
								aria-label="Decrease quantity"
								class="qty-btn"
								:disabled="busy"
								type="button"
								@click="updateItem(item.id, item.quantity - 1)"
							>
								−
							</button>
							<span>{{ item.quantity }}</span>
							<button
								aria-label="Increase quantity"
								class="qty-btn"
								:disabled="busy"
								type="button"
								@click="updateItem(item.id, item.quantity + 1)"
							>
								+
							</button>
						</div>
						<button
							class="bd-btn bd-btn--ghost cart-line__remove"
							:disabled="busy"
							type="button"
							@click="removeItem(item.id)"
						>
							Remove
						</button>
					</div>

					<div class="cart__coupon">
						<template v-if="cart.couponCode">
							<span class="bd-badge">Coupon: {{ cart.couponCode }}</span>
							<button
								class="bd-btn bd-btn--ghost"
								:disabled="busy"
								type="button"
								@click="removeCoupon"
							>
								Remove coupon
							</button>
						</template>
						<template v-else>
							<input
								v-model="couponInput"
								class="bd-input"
								placeholder="Coupon code"
							/>
							<button
								class="bd-btn bd-btn--ghost"
								:disabled="busy || !couponInput.trim()"
								type="button"
								@click="handleApplyCoupon"
							>
								Apply
							</button>
						</template>
					</div>

					<div class="cart__totals">
						<span>Subtotal</span>
						<strong>{{ formatMoney(cart.subtotal, cart.currency) }}</strong>
					</div>

					<div class="cart__actions">
						<button
							class="bd-btn bd-btn--ghost"
							:disabled="busy"
							type="button"
							@click="clear"
						>
							Clear cart
						</button>
						<button
							class="bd-btn"
							:disabled="checkingOut || busy"
							type="button"
							@click="handleCheckout"
						>
							{{ checkingOut ? "Starting…" : "Checkout" }}
						</button>
					</div>

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
