<!-- [bd-file:store] -->
<script lang="ts">
	import { onMount } from 'svelte';
	import Header from '#lib/components/bd/Header.svelte';
	import Footer from '#lib/components/bd/Footer.svelte';
	import StoreNav from '#lib/components/bd/StoreNav.svelte';
	import { formatCents, wishlist, type SavedProduct } from '#lib/bd/shop.ts';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let items = $state<SavedProduct[]>([]);
	let ready = $state(false);

	onMount(() => {
		items = wishlist.read();
		ready = true;
		return wishlist.subscribe((next) => (items = next));
	});
</script>

<svelte:head><title>Wishlist</title></svelte:head>

<Header />
<StoreNav cartCount={data.cartCount} />

<main class="bd-section">
	<div class="bd-section__lead">
		<h1 class="bd-section__title">Wishlist</h1>
		<p class="bd-section__sub">Saved on this device. Open a product to choose options and buy.</p>
	</div>

	{#if !ready}
		<p class="bd-loading">Loading…</p>
	{:else if items.length === 0}
		<div class="bd-empty">
			Nothing saved yet. Press <span aria-hidden="true">♡</span> Save on any product.
			<p><a class="bd-btn" href="/store">Browse products</a></p>
		</div>
	{:else}
		<ul class="wishlist bd-grid-4">
			{#each items as item (item.id)}
				<li class="bd-card wishlist__card">
					<a href={`/store/${item.id}`} class="wishlist__link">
						{#if item.image}
							<img src={item.image} alt="" loading="lazy" referrerpolicy="no-referrer" />
						{:else}
							<span class="wishlist__noimg" aria-hidden="true"></span>
						{/if}
						<span class="wishlist__name">{item.name}</span>
						{#if item.priceCents != null}
							<span class="wishlist__price">{formatCents(item.priceCents)}</span>
						{/if}
					</a>
					<button
						type="button"
						class="bd-btn bd-btn--ghost"
						onclick={() => wishlist.remove(item.id)}
					>
						Remove
					</button>
				</li>
			{/each}
		</ul>
		<p class="wishlist__clear">
			<button type="button" class="bd-btn bd-btn--ghost" onclick={() => wishlist.clear()}>
				Clear the wishlist
			</button>
		</p>
	{/if}
</main>

<Footer />

<style>
	.wishlist {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.wishlist__card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.9rem;
	}
	.wishlist__link {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		border-bottom: none;
	}
	.wishlist__link img,
	.wishlist__noimg {
		display: block;
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		border-radius: 0.6rem;
		background: var(--bg-soft);
	}
	.wishlist__name {
		color: var(--title);
		font-weight: 600;
	}
	.wishlist__price {
		color: var(--text-muted);
		font-size: 0.9rem;
	}
	.wishlist__clear {
		margin-top: 2rem;
	}
</style>
