<script lang="ts">
	/**
	 * Compact storefront sub-nav with a cart-count indicator. Reused by
	 * every /store route. `cartCount` is server-provided on load and
	 * re-fetched client-side after mutations so the badge stays live.
	 */
	let { cartCount = 0 }: { cartCount?: number } = $props();
</script>

<nav class="store-nav">
	<div class="store-nav__links">
		<a href="/store">Products</a>
		<a href="/store/subscriptions">Subscriptions</a>
	</div>
	<a class="store-nav__cart" href="/store/cart">
		Cart
		{#if cartCount > 0}
			<span class="store-nav__badge">{cartCount}</span>
		{/if}
	</a>
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
		gap: 1.25rem;
		font-size: 0.92rem;
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
