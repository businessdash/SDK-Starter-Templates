<script lang="ts">
	import { goto } from '$app/navigation';
	import Header from '$lib/components/biab/Header.svelte';
	import Footer from '$lib/components/biab/Footer.svelte';
	import StoreNav from '$lib/components/biab/StoreNav.svelte';
	import { addToCart, formatDollars, formatCents } from '$lib/biab/cart-client';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function asString(v: unknown): string {
		return typeof v === 'string' ? v : '';
	}
	function asNumber(v: unknown): number | null {
		return typeof v === 'number' && Number.isFinite(v) ? v : null;
	}
	function firstImage(images: unknown): string | null {
		return Array.isArray(images) && typeof images[0] === 'string'
			? images[0]
			: null;
	}

	type Variant = {
		id: string;
		name: string;
		price: number | null;
		isLive: boolean;
	};

	const variants: Variant[] = $derived(
		(data.product?.variants ?? []).map((raw) => ({
			id: asString(raw.id),
			name: asString(raw.name) || 'Default',
			price: asNumber(raw.price),
			isLive: raw.isLive !== false,
		})),
	);

	/** First purchasable variant id of an addon, for the rail's "Add" button. */
	function addonFirstVariantId(variants: unknown): string | undefined {
		if (!Array.isArray(variants)) return undefined;
		const first = variants[0] as { variantId?: unknown } | undefined;
		return first && typeof first.variantId === 'string'
			? first.variantId
			: undefined;
	}

	// svelte-ignore state_referenced_locally
	let cartCount = $state(data.cartCount);
	let selectedVariant = $state<string>('');
	let quantity = $state(1);
	let busy = $state(false);
	let message = $state<string | null>(null);
	let messageKind = $state<'ok' | 'error'>('ok');
	let addingAddon = $state<string | null>(null);
	let addedAddons = $state<Record<string, boolean>>({});

	$effect(() => {
		// Default to the first live variant once data is in.
		if (!selectedVariant && variants.length > 0) {
			selectedVariant = variants.find((v) => v.isLive)?.id ?? variants[0].id;
		}
	});

	async function handleAdd() {
		if (!data.product) return;
		busy = true;
		message = null;
		const res = await addToCart({
			productId: data.product.id,
			variantId: selectedVariant || undefined,
			quantity,
		});
		busy = false;
		if (res.ok) {
			cartCount = res.snapshot.itemCount;
			messageKind = 'ok';
			message = 'Added to cart.';
		} else {
			messageKind = 'error';
			message = res.error;
		}
	}

	async function handleAddAddon(addon: (typeof data.addons)[number]) {
		addingAddon = addon.id;
		const res = await addToCart({
			productId: addon.addonProductId,
			variantId: addonFirstVariantId(addon.variants),
			quantity: 1,
		});
		addingAddon = null;
		if (res.ok) {
			cartCount = res.snapshot.itemCount;
			addedAddons = { ...addedAddons, [addon.id]: true };
		}
	}
</script>

{#snippet stars(rating: number)}
	<span class="stars" role="img" aria-label={`${rating.toFixed(1)} out of 5`}>
		{#each [0, 1, 2, 3, 4] as i (i)}
			<span class="stars__star" class:stars__star--on={rating >= i + 1}>★</span>
		{/each}
	</span>
{/snippet}

<svelte:head>
	<title>{asString(data.product?.name) || 'Product'}</title>
</svelte:head>

<Header />
<StoreNav {cartCount} />

<main class="biab-section">
	{#if !data.configured}
		<div class="biab-empty">Store isn't connected.</div>
	{:else if data.product}
		<a href="/store" style="font-size: 0.9rem;">← Back to products</a>
		<div class="product-detail">
			<div class="product-detail__media">
				{#if firstImage(data.product.images)}
					<img src={firstImage(data.product.images)} alt={asString(data.product.name)} />
				{:else}
					<div class="product-detail__placeholder">No image</div>
				{/if}
			</div>
			<div class="product-detail__info biab-card">
				<h1>{asString(data.product.name) || 'Untitled'}</h1>

				{#if data.reviews && data.reviews.totalCount > 0}
					<div class="product-detail__rating">
						{@render stars(data.reviews.avgRating)}
						<span>{data.reviews.avgRating.toFixed(1)} ({data.reviews.totalCount})</span>
					</div>
				{/if}

				{#if asString((data.product as Record<string, unknown>).description)}
					<p class="product-detail__desc">
						{asString((data.product as Record<string, unknown>).description)}
					</p>
				{/if}

				{#if variants.length > 0}
					<div>
						<label class="biab-label" for="variant">Option</label>
						<select id="variant" class="biab-select" bind:value={selectedVariant}>
							{#each variants as v (v.id)}
								<option value={v.id} disabled={!v.isLive}>
									{v.name}{v.price != null ? ` — ${formatDollars(v.price)}` : ''}
									{v.isLive ? '' : ' (unavailable)'}
								</option>
							{/each}
						</select>
					</div>
				{/if}

				<div>
					<label class="biab-label" for="qty">Quantity</label>
					<input
						id="qty"
						class="biab-input"
						type="number"
						min="1"
						max="999"
						bind:value={quantity}
						style="max-width: 7rem;"
					/>
				</div>

				<button class="biab-btn" onclick={handleAdd} disabled={busy}>
					{busy ? 'Adding…' : 'Add to cart'}
				</button>

				{#if message}
					<div
						class="product-detail__msg"
						class:product-detail__msg--err={messageKind === 'error'}
					>
						{message}
						{#if messageKind === 'ok'}
							<button class="biab-btn biab-btn--ghost" onclick={() => goto('/store/cart')}>
								View cart
							</button>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		{#if data.addons.length > 0}
			<section class="product-section">
				<h2 class="product-section__title">Complete your purchase</h2>
				<div class="addon-grid">
					{#each data.addons as addon (addon.id)}
						<div class="addon-card biab-card">
							<div class="addon-card__media">
								{#if addon.imageUrl}
									<img src={addon.imageUrl} alt={addon.addonName} loading="lazy" referrerpolicy="no-referrer" />
								{:else}
									<div class="addon-card__noimg">—</div>
								{/if}
							</div>
							<div class="addon-card__body">
								{#if addon.groupLabel}
									<span class="addon-card__group">{addon.groupLabel}</span>
								{/if}
								<p class="addon-card__name">{addon.addonName}</p>
								{#if addon.priceCents != null}
									<span class="addon-card__price">{formatCents(addon.priceCents)}</span>
								{/if}
							</div>
							<button
								class="biab-btn biab-btn--ghost addon-card__add"
								onclick={() => handleAddAddon(addon)}
								disabled={addingAddon === addon.id || addedAddons[addon.id]}
							>
								{addedAddons[addon.id]
									? 'Added'
									: addingAddon === addon.id
										? '…'
										: 'Add'}
							</button>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		{#if data.reviews && data.reviews.items.length > 0}
			<section class="product-section">
				<h2 class="product-section__title">Reviews</h2>
				<div class="review-list">
					{#each data.reviews.items as review (review.id)}
						{@const name = asString(review.reviewerName) || 'Verified buyer'}
						{@const text = asString(review.content) || asString(review.body)}
						{@const title = asString(review.title)}
						<div class="review">
							<div class="review__head">
								{@render stars(asNumber(review.rating) ?? 0)}
								<span class="review__name">{name}</span>
							</div>
							{#if title}
								<p class="review__title">{title}</p>
							{/if}
							{#if text}
								<p class="review__body">{text}</p>
							{/if}
						</div>
					{/each}
				</div>
			</section>
		{/if}

		{#if data.related.length > 0}
			<section class="product-section">
				<h2 class="product-section__title">You may also like</h2>
				<div class="biab-grid-4">
					{#each data.related as rp (rp.id)}
						<a class="biab-card related-card" href={`/store/${rp.id}`}>
							<div class="related-card__media">
								{#if rp.coverImageUrl}
									<img src={rp.coverImageUrl} alt={rp.name} loading="lazy" referrerpolicy="no-referrer" />
								{:else}
									<div class="related-card__noimg">—</div>
								{/if}
							</div>
							<div class="related-card__body">
								<h3>{rp.name}</h3>
								{#if rp.minPriceDollars != null}
									<span class="related-card__price">{formatDollars(rp.minPriceDollars)}</span>
								{/if}
							</div>
						</a>
					{/each}
				</div>
			</section>
		{/if}
	{/if}
</main>

<Footer />

<style>
	.product-detail {
		display: grid;
		grid-template-columns: 1fr;
		gap: 2rem;
		margin-top: 1.5rem;
	}
	@media (min-width: 800px) {
		.product-detail {
			grid-template-columns: 1fr 1fr;
		}
	}
	.product-detail__media img {
		width: 100%;
		border-radius: 1rem;
		object-fit: cover;
	}
	.product-detail__placeholder {
		display: grid;
		place-items: center;
		aspect-ratio: 4 / 3;
		border: 1px dashed var(--border-strong);
		border-radius: 1rem;
		color: var(--text-muted);
	}
	.product-detail__info {
		padding: 2rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.product-detail__rating {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		color: var(--text-muted);
	}
	.product-detail__desc {
		color: var(--text-muted);
	}
	.product-detail__msg {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		background: var(--success-bg);
		color: var(--success);
		font-size: 0.9rem;
	}
	.product-detail__msg--err {
		background: var(--danger-bg);
		color: var(--danger);
	}

	.stars {
		display: inline-flex;
		gap: 0.05rem;
		line-height: 1;
	}
	.stars__star {
		color: var(--border-strong);
		font-size: 0.85rem;
	}
	.stars__star--on {
		color: #e8a317;
	}

	/* Shared section scaffolding for addons / reviews / related */
	.product-section {
		margin-top: 3rem;
	}
	.product-section__title {
		font-size: 1.4rem;
		margin-bottom: 1.25rem;
	}

	.addon-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.85rem;
	}
	@media (min-width: 600px) {
		.addon-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (min-width: 900px) {
		.addon-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}
	.addon-card {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.75rem;
	}
	.addon-card:hover {
		transform: none;
	}
	.addon-card__media {
		width: 4rem;
		height: 4rem;
		flex-shrink: 0;
		border-radius: 0.5rem;
		overflow: hidden;
		background: var(--bg-soft);
	}
	.addon-card__media img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.addon-card__noimg {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		color: var(--text-muted);
	}
	.addon-card__body {
		min-width: 0;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.addon-card__group {
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--accent);
	}
	.addon-card__name {
		font-weight: 600;
		color: var(--title);
		font-size: 0.92rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.addon-card__price {
		color: var(--accent);
		font-weight: 700;
		font-size: 0.88rem;
	}
	.addon-card__add {
		flex-shrink: 0;
		padding: 0.45rem 0.9rem;
		font-size: 0.8rem;
	}

	.review-list {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.review {
		padding-bottom: 1.25rem;
		border-bottom: 1px solid var(--border);
	}
	.review__head {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.review__name {
		font-weight: 600;
		color: var(--title);
		font-size: 0.9rem;
	}
	.review__title {
		margin-top: 0.4rem;
		font-weight: 600;
		color: var(--title);
		font-size: 0.92rem;
	}
	.review__body {
		margin-top: 0.25rem;
		color: var(--text-muted);
		font-size: 0.92rem;
		line-height: 1.55;
	}

	.related-card {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		color: inherit;
	}
	.related-card:hover {
		border-bottom-color: transparent;
	}
	.related-card__media {
		aspect-ratio: 1 / 1;
		background: var(--bg-soft);
	}
	.related-card__media img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.related-card__noimg {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		color: var(--text-muted);
	}
	.related-card__body {
		padding: 0.85rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.related-card__body h3 {
		font-size: 0.92rem;
	}
	.related-card__price {
		color: var(--accent);
		font-weight: 700;
		font-size: 0.88rem;
	}
</style>
