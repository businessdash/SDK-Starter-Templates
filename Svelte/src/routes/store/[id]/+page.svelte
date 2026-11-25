<!-- [bd-file:store] -->
<script lang="ts">
	/**
	 * One product, laid out by `ProductDetail` from the shop's parts in
	 * `#lib/components/bd/shop/`: photos that follow the chosen option, option
	 * and size buttons, the price for what's chosen, add to cart, save,
	 * compare, share, details, add-ons, reviews, related and recently viewed.
	 */
	import Header from '#lib/components/bd/Header.svelte';
	import Footer from '#lib/components/bd/Footer.svelte';
	import StoreNav from '#lib/components/bd/StoreNav.svelte';
	import ProductDetail from '#lib/components/bd/shop/ProductDetail.svelte';
	import { galleryFor, toProductView } from '#lib/bd/shop.ts';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const view = $derived(data.product ? toProductView(data.product) : null);
	const cover = $derived(view ? galleryFor(view, '')[0] : undefined);

	// svelte-ignore state_referenced_locally
	let cartCount = $state(data.cartCount);
	const moreReviewsHref = $derived(
		data.reviews && data.reviews.totalCount > data.reviews.items.length
			? `?reviews=${data.reviewLimit + 10}#reviews`
			: null
	);
</script>

<svelte:head>
	<title>{view?.name ?? 'Product'}</title>
	{#if view?.description}<meta name="description" content={view.description.slice(0, 160)} />{/if}
	{#if cover}<meta property="og:image" content={cover} />{/if}
</svelte:head>

<Header />
<StoreNav {cartCount} />

<main class="bd-section">
	{#if !data.configured}
		<div class="bd-empty">Store isn't connected.</div>
	{:else if data.product}
		<ProductDetail
			product={data.product}
			reviews={data.reviews}
			addons={data.addons}
			related={data.related}
			{moreReviewsHref}
			shareUrl={data.shareUrl}
			onCartCount={(count) => (cartCount = count)}
		/>
	{/if}
</main>

<Footer />
