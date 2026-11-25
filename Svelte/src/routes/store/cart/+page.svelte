<!-- [bd-file:store] -->
<script lang="ts">
	/**
	 * The cart, laid out from the shop's parts in `#lib/components/bd/shop/`:
	 * a cart line per item, the coupon, the subtotal, and Clear cart /
	 * Checkout.
	 */
	import Header from '#lib/components/bd/Header.svelte';
	import Footer from '#lib/components/bd/Footer.svelte';
	import StoreNav from '#lib/components/bd/StoreNav.svelte';
	import CartActions from '#lib/components/bd/shop/CartActions.svelte';
	import CartLine from '#lib/components/bd/shop/CartLine.svelte';
	import CartSummary from '#lib/components/bd/shop/CartSummary.svelte';
	import CouponForm from '#lib/components/bd/shop/CouponForm.svelte';
	import type { CartSnapshot } from '@businessdash/sdk/contracts';
	import {
		applyCoupon,
		clearCart,
		removeCartItem,
		removeCoupon,
		startCheckout,
		updateCartItem,
		type CartCallResult
	} from '#lib/bd/cart-client.ts';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Seed from the server-loaded cart, then mutate in place after each
	// add/update/remove. Intentionally a one-time snapshot of `data`.
	// svelte-ignore state_referenced_locally
	let snapshot = $state<CartSnapshot | null>(data.snapshot);
	let busy = $state(false);
	let error = $state<string | null>(null);

	const currency = $derived(snapshot?.currency ?? 'USD');
	const cartCount = $derived(snapshot?.itemCount ?? 0);

	function apply(result: CartCallResult) {
		if (result.ok) {
			snapshot = result.snapshot;
			error = null;
		} else {
			error = result.error;
		}
	}

	async function withBusy(fn: () => Promise<CartCallResult>) {
		busy = true;
		apply(await fn());
		busy = false;
	}

	async function checkout() {
		busy = true;
		error = null;
		const res = await startCheckout();
		busy = false;
		if (res.ok) {
			window.location.href = res.url;
		} else {
			error = res.error;
		}
	}
</script>

<svelte:head><title>Cart</title></svelte:head>

<Header />
<StoreNav {cartCount} />

<main class="bd-section bd-section--narrow">
	<div class="bd-section__lead">
		<span class="bd-section__eyebrow">Checkout</span>
		<h1 class="bd-section__title">Your cart</h1>
	</div>

	{#if !data.configured}
		<div class="bd-empty">Store isn't connected.</div>
	{:else if !snapshot || snapshot.items.length === 0}
		<div class="bd-empty">
			Your cart is empty. <a href="/store">Browse products →</a>
		</div>
	{:else}
		<div class="bd-card cart">
			{#each snapshot.items as item (item.id)}
				<CartLine
					{item}
					{currency}
					{busy}
					onQuantity={(quantity) => withBusy(() => updateCartItem(item.id, quantity))}
					onRemove={() => withBusy(() => removeCartItem(item.id))}
				/>
			{/each}
			<CouponForm
				code={snapshot.couponCode}
				{busy}
				onApply={(code) => withBusy(() => applyCoupon(code))}
				onRemove={() => withBusy(removeCoupon)}
			/>
			<CartSummary subtotal={snapshot.subtotal} {currency} />
			<CartActions {busy} onClear={() => withBusy(clearCart)} onCheckout={checkout} />
		</div>
	{/if}

	{#if error}
		<div
			style="color: var(--danger); background: var(--danger-bg); padding: 0.75rem 1rem; border-radius: 0.5rem; font-size: 0.9rem; margin-top: 1rem;"
		>
			{error}
		</div>
	{/if}
</main>

<Footer />

<style>
	.cart {
		padding: 1.5rem 2rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
</style>
