<script lang="ts">
	import Header from '$lib/components/bd/Header.svelte';
	import Footer from '$lib/components/bd/Footer.svelte';
	import StoreNav from '$lib/components/bd/StoreNav.svelte';
	import { formatCents } from '$lib/bd/cart-client';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const paid = $derived(data.status?.paymentStatus === 'paid');
</script>

<svelte:head><title>Order</title></svelte:head>

<Header />
<StoreNav />

<main class="bd-section bd-section--narrow">
	<div class="bd-card order">
		{#if data.status && paid}
			<span class="bd-badge" style="align-self: flex-start;">Paid</span>
			<h1 class="bd-section__title">Thanks for your order.</h1>
			{#if data.status.customerName}
				<p>We've emailed a receipt to {data.status.customerEmail ?? 'you'}.</p>
			{/if}
			{#if data.status.amountTotalCents != null}
				<p class="order__total">
					Total paid:
					<strong>{formatCents(data.status.amountTotalCents, data.status.currency ?? 'USD')}</strong>
				</p>
			{/if}
		{:else if data.status}
			<h1 class="bd-section__title">Payment pending</h1>
			<p>
				Your checkout session is <strong>{data.status.paymentStatus}</strong>. If
				you completed payment, it may take a moment to confirm.
			</p>
		{:else}
			<h1 class="bd-section__title">Order status unavailable</h1>
			<p>We couldn't look up this checkout session.</p>
		{/if}
		<a class="bd-btn bd-btn--ghost" href="/store" style="align-self: flex-start;">
			Continue shopping
		</a>
	</div>
</main>

<Footer />

<style>
	.order {
		padding: 2.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.order__total {
		font-size: 1.05rem;
	}
</style>
