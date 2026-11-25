<!-- [bd-file:store,subscriptions] -->
<script lang="ts">
	/**
	 * Compact storefront sub-nav with a cart-count indicator. Reused by
	 * every /store route. `cartCount` is server-provided on load and
	 * re-fetched client-side after mutations so the badge stays live.
	 */
	let { cartCount = 0 }: { cartCount?: number } = $props();
	// [bd:store]
	import { onMount } from 'svelte';
	import { compareList, wishlist } from '#lib/bd/shop.ts';

	// The saved lists live in this browser, so their counts arrive after load.
	let saved = $state(0);
	let comparing = $state(0);
	onMount(() => {
		saved = wishlist.read().length;
		comparing = compareList.read().length;
		const offWish = wishlist.subscribe((items) => (saved = items.length));
		const offCompare = compareList.subscribe((items) => (comparing = items.length));
		return () => {
			offWish();
			offCompare();
		};
	});
	// [/bd:store]
</script>

<nav class="store-nav">
	<div class="store-nav__links">
		<!-- [bd:store] -->
		<a href="/store">Products</a>
		<!-- [/bd:store] -->
		<!-- [bd:subscriptions] -->
		<a href="/store/subscriptions">Subscriptions</a>
		<!-- [/bd:subscriptions] -->
	</div>
	<!-- [bd:store] -->
	<div class="store-nav__links">
		<a href="/store/wishlist">
			Wishlist
			{#if saved > 0}<span class="store-nav__count">{saved}</span>{/if}
		</a>
		<a href="/store/compare">
			Compare
			{#if comparing > 0}<span class="store-nav__count">{comparing}</span>{/if}
		</a>
		<a class="store-nav__cart" href="/store/cart">
			Cart
			{#if cartCount > 0}
				<span class="store-nav__badge">{cartCount}</span>
			{/if}
		</a>
	</div>
	<!-- [/bd:store] -->
</nav>

<style>
	.store-nav {
		max-width: 72rem;
		margin: 0 auto;
		padding: 1rem 1.25rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		border-bottom: 1px solid var(--border);
	}
	.store-nav__links {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1.25rem;
		font-size: 0.92rem;
	}
	/* Narrow screens: one row of links that scrolls sideways. */
	@media (max-width: 640px) {
		.store-nav {
			justify-content: flex-start;
			gap: 1.25rem;
			overflow-x: auto;
			white-space: nowrap;
			scrollbar-width: none;
		}
		.store-nav__links {
			flex-wrap: nowrap;
		}
	}
	.store-nav__count {
		margin-left: 0.2rem;
		color: var(--text-muted);
		font-size: 0.8rem;
	}
	.store-nav__cart {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-weight: 600;
	}
	.store-nav__badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.4rem;
		height: 1.4rem;
		padding: 0 0.4rem;
		border-radius: 9999px;
		background: var(--accent);
		color: white;
		font-size: 0.75rem;
		font-weight: 700;
	}
</style>
