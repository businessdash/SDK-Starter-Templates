<!-- [bd-file:store] -->
<script lang="ts">
	/**
	 * The whole product page: photos that follow the chosen option, option and
	 * size buttons, the price for what's chosen, add to cart, save and compare,
	 * share, details, add-ons, reviews, related products and what was viewed
	 * before.
	 *
	 * It holds what's chosen and lays the page out from the parts imported
	 * below, one file each, so you can move, restyle or drop any part, or lay
	 * them out your own way. `onCartCount` gets the cart's item count after an
	 * add, for the store bar.
	 */
	import type {
		StorefrontAddonsResponse,
		StorefrontProductReviewsResponse,
		StorefrontRelatedProductsResponse
	} from '@businessdash/sdk/contracts';
	import { addToCart } from '#lib/bd/cart-client.ts';
	import {
		chosenOptions,
		defaultVariant,
		galleryFor,
		optionGroupsFor,
		priceFor,
		toProductView,
		type SavedProduct
	} from '#lib/bd/shop.ts';
	import CompareBar from '../CompareBar.svelte';
	import ProductRail from '../ProductRail.svelte';
	import SaveButtons from '../SaveButtons.svelte';
	import AddToCartButton from './AddToCartButton.svelte';
	import CartNotice from './CartNotice.svelte';
	import OptionPicker from './OptionPicker.svelte';
	import ProductAddons from './ProductAddons.svelte';
	import ProductBreadcrumbs from './ProductBreadcrumbs.svelte';
	import ProductGallery from './ProductGallery.svelte';
	import ProductPolicies from './ProductPolicies.svelte';
	import ProductPrice from './ProductPrice.svelte';
	import ProductReviews from './ProductReviews.svelte';
	import ProductSpecs from './ProductSpecs.svelte';
	import ProductTitle from './ProductTitle.svelte';
	import QuantityStepper from './QuantityStepper.svelte';
	import RecentlyViewed from './RecentlyViewed.svelte';
	import ShareButton from './ShareButton.svelte';
	import StockNote from './StockNote.svelte';
	import VariantPicker from './VariantPicker.svelte';

	let {
		product,
		reviews,
		addons,
		related,
		moreReviewsHref = null,
		shareUrl,
		storeHref = '/store',
		cartHref = '/store/cart',
		contactHref = '/#contact',
		onCartCount
	}: {
		product: Record<string, unknown>;
		reviews: StorefrontProductReviewsResponse | null;
		addons: StorefrontAddonsResponse['items'];
		related: StorefrontRelatedProductsResponse['items'];
		moreReviewsHref?: string | null;
		shareUrl: string;
		storeHref?: string;
		cartHref?: string;
		contactHref?: string;
		onCartCount?: (count: number) => void;
	} = $props();

	const view = $derived(toProductView(product));

	let variantId = $state('');
	let chosen = $state<Record<string, string>>({});
	let photo = $state(0);
	let quantity = $state(1);
	let busy = $state(false);
	let message = $state<{ kind: 'ok' | 'error'; text: string } | null>(null);

	// A new product (following a related link) starts over.
	$effect(() => {
		variantId = defaultVariant(view)?.id ?? '';
		chosen = {};
		photo = 0;
		message = null;
	});

	const gallery = $derived(galleryFor(view, variantId));
	const groups = $derived(optionGroupsFor(view, variantId));
	const price = $derived(priceFor(view, variantId, chosen));
	const summary = $derived<SavedProduct>({
		id: view.id,
		name: view.name,
		image: view.images[0] ?? null,
		priceCents:
			price.amount != null
				? Math.round(price.amount * 100)
				: (view.variants[0]?.price ?? null) != null
					? Math.round((view.variants[0]?.price ?? 0) * 100)
					: null
	});
	const relatedCards = $derived<SavedProduct[]>(
		related.map((rp) => ({
			id: rp.id,
			name: rp.name,
			image: rp.coverImageUrl,
			priceCents: rp.minPriceDollars != null ? Math.round(rp.minPriceDollars * 100) : null
		}))
	);

	function pickVariant(id: string) {
		variantId = id;
		chosen = {};
		photo = 0;
	}

	async function handleAdd() {
		if (!price.ready) return;
		busy = true;
		message = null;
		const res = await addToCart({
			productId: view.id,
			variantId: variantId || undefined,
			quantity,
			options: chosenOptions(view, variantId, chosen)
		});
		busy = false;
		if (res.ok) {
			onCartCount?.(res.snapshot.itemCount);
			message = { kind: 'ok', text: `Added ${quantity} to your cart.` };
		} else {
			message = { kind: 'error', text: res.error };
		}
	}
</script>

<ProductBreadcrumbs product={view} {storeHref} />

<div class="product-detail">
	<ProductGallery photos={gallery} name={view.name} bind:photo />

	<div class="product-detail__info bd-card">
		<ProductTitle product={view} {reviews} />
		<ProductPrice {price} {quantity} />

		{#if view.description}
			<p class="product-detail__desc">{view.description}</p>
		{/if}

		<VariantPicker
			variants={view.variants}
			selected={variantId}
			showPrices={groups.length === 0}
			onPick={pickVariant}
		/>
		{#each groups as group (group.id)}
			<OptionPicker
				{group}
				chosen={chosen[group.id]}
				onPick={(valueId) => (chosen = { ...chosen, [group.id]: valueId })}
			/>
		{/each}
		<StockNote stock={price.stock} />

		<div class="buy">
			<QuantityStepper bind:quantity max={price.stock} />
			<AddToCartButton {price} {busy} onAdd={handleAdd} />
		</div>
		<CartNotice {message} {cartHref} />

		<div class="product-detail__tools">
			<SaveButtons product={summary} />
			<ShareButton url={shareUrl} title={view.name} />
		</div>
		<ProductPolicies {contactHref} />
	</div>
</div>

<ProductSpecs features={view.features} specs={view.specs} />
<ProductAddons {addons} onAdded={onCartCount} />
<ProductReviews {reviews} moreHref={moreReviewsHref} />
<ProductRail title="You may also like" products={relatedCards} />
{#key view.id}<RecentlyViewed product={summary} />{/key}
<CompareBar />

<style>
	.product-detail {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 2rem;
		margin-top: 1.25rem;
	}
	@media (min-width: 860px) {
		.product-detail {
			grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
			align-items: start;
		}
	}
	.product-detail__info {
		padding: 2rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.product-detail__desc {
		margin: 0;
		color: var(--text);
		white-space: pre-line;
	}
	.buy {
		display: flex;
		gap: 0.75rem;
		align-items: stretch;
	}
	.product-detail__tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}
</style>
