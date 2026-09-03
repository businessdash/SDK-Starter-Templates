<script lang="ts">
	import Header from '$lib/components/bd/Header.svelte';
	import Footer from '$lib/components/bd/Footer.svelte';
	import StoreNav from '$lib/components/bd/StoreNav.svelte';
	import type { CartSnapshot } from '@businessdash/sdk/contracts';
	import {
		applyCoupon,
		clearCart,
		formatDollars,
		removeCartItem,
		removeCoupon,
		startCheckout,
		updateCartItem,
		type CartCallResult,
	} from '$lib/bd/cart-client';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Seed from the server-loaded cart, then mutate in place after each
	// add/update/remove. Intentionally a one-time snapshot of `data`.
	// svelte-ignore state_referenced_locally
	let snapshot = $state<CartSnapshot | null>(data.snapshot);
	let busy = $state(false);
	let error = $state<string | null>(null);
	let couponCode = $state('');

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
				<div class="cart-row">
					{#if item.productImage}
						<img class="cart-row__img" src={item.productImage} alt={item.productName ?? ''} />
					{/if}
					<div class="cart-row__main">
						<strong>{item.productName ?? 'Item'}</strong>
						{#if item.variantTitle}
							<span class="cart-row__variant">{item.variantTitle}</span>
						{/if}
						<span class="cart-row__unit">{formatDollars(item.unitPrice, currency)} ea</span>
					</div>
					<div class="cart-row__qty">
						<input
							class="bd-input"
							type="number"
							min="0"
							max="999"
							value={item.quantity}
							onchange={(e) =>
								withBusy(() =>
									updateCartItem(item.id, Number(e.currentTarget.value)),
								)}
							style="width: 4.5rem;"
							disabled={busy}
						/>
						<button
							class="cart-row__remove"
							onclick={() => withBusy(() => removeCartItem(item.id))}
							disabled={busy}
							aria-label="Remove item"
						>
							Remove
						</button>
					</div>
					<div class="cart-row__subtotal">{formatDollars(item.subtotal, currency)}</div>
				</div>
			{/each}

			<div class="cart-coupon">
				{#if snapshot.couponCode}
					<span class="bd-badge">Coupon: {snapshot.couponCode}</span>
					<button
						class="bd-btn bd-btn--ghost"
						onclick={() => withBusy(removeCoupon)}
						disabled={busy}
					>
						Remove coupon
					</button>
				{:else}
					<input
						class="bd-input"
						placeholder="Coupon code"
						bind:value={couponCode}
						style="max-width: 12rem;"
					/>
					<button
						class="bd-btn bd-btn--ghost"
						onclick={() => couponCode && withBusy(() => applyCoupon(couponCode))}
						disabled={busy || !couponCode}
					>
						Apply
					</button>
				{/if}
			</div>

			<div class="cart-total">
				<span>Subtotal</span>
				<strong>{formatDollars(snapshot.subtotal, currency)}</strong>
			</div>

			<div class="cart-actions">
				<button class="bd-btn bd-btn--ghost" onclick={() => withBusy(clearCart)} disabled={busy}>
					Clear cart
				</button>
				<button class="bd-btn" onclick={checkout} disabled={busy}>
					{busy ? 'Working…' : 'Checkout'}
				</button>
			</div>
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
	.cart-row {
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		align-items: center;
		gap: 1rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--border);
	}
	.cart-row__img {
		width: 3.5rem;
		height: 3.5rem;
		object-fit: cover;
		border-radius: 0.5rem;
	}
	.cart-row__main {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.cart-row__variant,
	.cart-row__unit {
		color: var(--text-muted);
		font-size: 0.82rem;
	}
	.cart-row__qty {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.cart-row__remove {
		background: none;
		border: none;
		color: var(--danger);
		font-size: 0.8rem;
		text-decoration: underline;
	}
	.cart-row__subtotal {
		font-weight: 700;
		min-width: 5rem;
		text-align: right;
	}
	.cart-coupon {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
	.cart-total {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 1.1rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--border);
	}
	.cart-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
	}
</style>
