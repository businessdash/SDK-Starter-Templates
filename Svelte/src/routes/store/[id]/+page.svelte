<!-- [bd-file:store] -->
<script lang="ts">
	import { onMount } from 'svelte';
	import Header from '#lib/components/bd/Header.svelte';
	import Footer from '#lib/components/bd/Footer.svelte';
	import StoreNav from '#lib/components/bd/StoreNav.svelte';
	import SaveButtons from '#lib/components/bd/SaveButtons.svelte';
	import ProductRail from '#lib/components/bd/ProductRail.svelte';
	import CompareBar from '#lib/components/bd/CompareBar.svelte';
	import { addToCart } from '#lib/bd/cart-client.ts';
	import {
		chosenOptions,
		defaultVariant,
		formatCents,
		formatDollars,
		galleryFor,
		optionGroupsFor,
		priceFor,
		recentlyViewed,
		shareLink,
		toProductView,
		type SavedProduct
	} from '#lib/bd/shop.ts';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const view = $derived(data.product ? toProductView(data.product) : null);

	// svelte-ignore state_referenced_locally
	let cartCount = $state(data.cartCount);
	let variantId = $state('');
	let chosen = $state<Record<string, string>>({});
	let photo = $state(0);
	let quantity = $state(1);
	let busy = $state(false);
	let message = $state<{ kind: 'ok' | 'error'; text: string } | null>(null);
	let shareNote = $state('');
	let addingAddon = $state<string | null>(null);
	let addedAddons = $state<Record<string, boolean>>({});
	let recent = $state<SavedProduct[]>([]);

	// A new product (following a related link) starts over.
	$effect(() => {
		if (!view) return;
		variantId = defaultVariant(view)?.id ?? '';
		chosen = {};
		photo = 0;
		message = null;
	});

	const gallery = $derived(view ? galleryFor(view, variantId) : []);
	const groups = $derived(view ? optionGroupsFor(view, variantId) : []);
	const price = $derived(view ? priceFor(view, variantId, chosen) : null);
	const summary = $derived<SavedProduct | null>(
		view
			? {
					id: view.id,
					name: view.name,
					image: view.images[0] ?? null,
					priceCents:
						price?.amount != null
							? Math.round(price.amount * 100)
							: (view.variants[0]?.price ?? null) != null
								? Math.round((view.variants[0]?.price ?? 0) * 100)
								: null
				}
			: null
	);
	const cta = $derived(
		!price || price.amount === null
			? 'Sold out'
			: !price.ready
				? 'Choose options'
				: busy
					? 'Adding…'
					: 'Add to cart'
	);

	onMount(() => {
		if (!summary) return;
		// Shown before this one is added, so the product isn't in its own list.
		recent = recentlyViewed.read().filter((item) => item.id !== summary.id);
		recentlyViewed.add(summary);
	});

	function pickVariant(id: string) {
		variantId = id;
		chosen = {};
		photo = 0;
	}

	async function handleAdd() {
		if (!view || !price?.ready) return;
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
			cartCount = res.snapshot.itemCount;
			message = { kind: 'ok', text: `Added ${quantity} to your cart.` };
		} else {
			message = { kind: 'error', text: res.error };
		}
	}

	/** First purchasable variant id of an addon, for the rail's "Add" button. */
	function addonFirstVariantId(variants: unknown): string | undefined {
		if (!Array.isArray(variants)) return undefined;
		const first = variants[0] as { variantId?: unknown; id?: unknown } | undefined;
		const id = first?.variantId ?? first?.id;
		return typeof id === 'string' ? id : undefined;
	}

	async function handleAddAddon(addon: (typeof data.addons)[number]) {
		addingAddon = addon.id;
		const res = await addToCart({
			productId: addon.addonProductId,
			variantId: addonFirstVariantId(addon.variants),
			quantity: 1
		});
		addingAddon = null;
		if (res.ok) {
			cartCount = res.snapshot.itemCount;
			addedAddons = { ...addedAddons, [addon.id]: true };
		}
	}

	async function share() {
		if (!view) return;
		const result = await shareLink(data.shareUrl, view.name);
		shareNote = result === 'copied' ? 'Link copied' : result === 'failed' ? "Couldn't share" : '';
		if (shareNote) setTimeout(() => (shareNote = ''), 2500);
	}

	function text(v: unknown): string {
		return typeof v === 'string' ? v : '';
	}
	function reviewDate(iso: unknown): string {
		const date = typeof iso === 'string' ? new Date(iso) : null;
		return date && !Number.isNaN(date.getTime())
			? date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
			: '';
	}

	const related = $derived<SavedProduct[]>(
		data.related.map((rp) => ({
			id: rp.id,
			name: rp.name,
			image: rp.coverImageUrl,
			priceCents: rp.minPriceDollars != null ? Math.round(rp.minPriceDollars * 100) : null
		}))
	);
	const moreReviews = $derived(
		data.reviews ? data.reviews.totalCount > data.reviews.items.length : false
	);
</script>

{#snippet stars(rating: number)}
	<span class="stars" role="img" aria-label={`${rating.toFixed(1)} out of 5`}>
		{#each [0, 1, 2, 3, 4] as i (i)}
			<span class="stars__star" class:stars__star--on={rating >= i + 0.5}>★</span>
		{/each}
	</span>
{/snippet}

<svelte:head>
	<title>{view?.name ?? 'Product'}</title>
	{#if view?.description}<meta name="description" content={view.description.slice(0, 160)} />{/if}
	{#if gallery[0]}<meta property="og:image" content={gallery[0]} />{/if}
</svelte:head>

<Header />
<StoreNav {cartCount} />

<main class="bd-section">
	{#if !data.configured}
		<div class="bd-empty">Store isn't connected.</div>
	{:else if view}
		<nav class="crumbs" aria-label="Breadcrumb">
			<a href="/store">Store</a>
			{#if view.categoryId}
				<span aria-hidden="true">/</span>
				<a href={`/store?category=${view.categoryId}`}>{view.categoryName ?? 'Category'}</a>
			{/if}
			<span aria-hidden="true">/</span>
			<span aria-current="page">{view.name}</span>
		</nav>

		<div class="product-detail">
			<div class="gallery">
				<div class="gallery__main">
					{#if gallery[photo]}
						<img src={gallery[photo]} alt={view.name} referrerpolicy="no-referrer" />
					{:else}
						<div class="gallery__placeholder">No photo yet</div>
					{/if}
					{#if gallery.length > 1}
						<button
							type="button"
							class="gallery__step gallery__step--prev"
							aria-label="Previous photo"
							onclick={() => (photo = (photo - 1 + gallery.length) % gallery.length)}>‹</button
						>
						<button
							type="button"
							class="gallery__step gallery__step--next"
							aria-label="Next photo"
							onclick={() => (photo = (photo + 1) % gallery.length)}>›</button
						>
					{/if}
				</div>
				{#if gallery.length > 1}
					<div class="gallery__thumbs">
						{#each gallery as src, i (src + i)}
							<button
								type="button"
								class="gallery__thumb"
								class:gallery__thumb--on={i === photo}
								aria-label={`Photo ${i + 1} of ${gallery.length}`}
								aria-current={i === photo}
								onclick={() => (photo = i)}
							>
								<img {src} alt="" loading="lazy" referrerpolicy="no-referrer" />
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<div class="product-detail__info bd-card">
				<div>
					{#if view.categoryName}<p class="product-detail__eyebrow">{view.categoryName}</p>{/if}
					<h1>{view.name}</h1>
					{#if data.reviews && data.reviews.totalCount > 0}
						<a class="product-detail__rating" href="#reviews">
							{@render stars(data.reviews.avgRating)}
							<span>{data.reviews.avgRating.toFixed(1)} · {data.reviews.totalCount} reviews</span>
						</a>
					{/if}
				</div>

				<p class="product-detail__price">
					{#if price?.amount != null}
						{#if price.from}<span class="product-detail__from">From</span>{/if}
						{formatDollars(price.amount * quantity)}
						{#if quantity > 1}<span class="product-detail__each">
								({formatDollars(price.amount)} each)</span
							>{/if}
					{:else}
						Sold out
					{/if}
				</p>

				{#if view.description}
					<p class="product-detail__desc">{view.description}</p>
				{/if}

				{#if view.variants.length > 1}
					<fieldset class="choice">
						<legend class="bd-label">Option</legend>
						<div class="choice__values">
							{#each view.variants as v (v.id)}
								<button
									type="button"
									class="choice__value"
									class:choice__value--on={v.id === variantId}
									aria-pressed={v.id === variantId}
									disabled={!v.available}
									onclick={() => pickVariant(v.id)}
								>
									{v.name}
									{#if v.price != null && groups.length === 0}
										<small>{formatDollars(v.price)}</small>
									{/if}
								</button>
							{/each}
						</div>
					</fieldset>
				{/if}

				{#each groups as group (group.id)}
					<fieldset class="choice">
						<legend class="bd-label">
							{group.title}
							{#if chosen[group.id]}
								<span class="choice__picked">
									{group.values.find((v) => v.id === chosen[group.id])?.value}
								</span>
							{/if}
						</legend>
						<div class="choice__values">
							{#each group.values as value (value.id)}
								<button
									type="button"
									class="choice__value"
									class:choice__value--on={chosen[group.id] === value.id}
									aria-pressed={chosen[group.id] === value.id}
									disabled={!value.available}
									title={value.available ? undefined : 'Sold out'}
									onclick={() => (chosen = { ...chosen, [group.id]: value.id })}
								>
									{value.value}
								</button>
							{/each}
						</div>
					</fieldset>
				{/each}

				{#if price?.stock != null && price.stock > 0 && price.stock <= 5}
					<p class="product-detail__stock">Only {price.stock} left</p>
				{/if}

				<div class="buy">
					<div class="qty" role="group" aria-label="Quantity">
						<button
							type="button"
							aria-label="One fewer"
							disabled={quantity <= 1}
							onclick={() => (quantity = Math.max(1, quantity - 1))}>−</button
						>
						<span aria-live="polite">{quantity}</span>
						<button
							type="button"
							aria-label="One more"
							disabled={price?.stock != null && quantity >= price.stock}
							onclick={() => (quantity = Math.min(999, quantity + 1))}>+</button
						>
					</div>
					<button class="bd-btn buy__add" onclick={handleAdd} disabled={busy || !price?.ready}>
						{cta}
					</button>
				</div>

				{#if message}
					<div
						class="product-detail__msg"
						class:product-detail__msg--err={message.kind === 'error'}
						role="status"
					>
						{message.text}
						{#if message.kind === 'ok'}
							<a class="bd-btn bd-btn--ghost" href="/store/cart">View cart</a>
						{/if}
					</div>
				{/if}

				<div class="product-detail__tools">
					{#if summary}<SaveButtons product={summary} />{/if}
					<button type="button" class="share" onclick={share}>
						<span aria-hidden="true">↗</span> Share
					</button>
					{#if shareNote}<span class="share__note" role="status">{shareNote}</span>{/if}
				</div>

				<ul class="policies">
					<li>Secure checkout with Stripe</li>
					<li>Questions? <a href="/#contact">Ask us</a> before you buy</li>
				</ul>
			</div>
		</div>

		{#if view.features.length > 0 || view.specs.length > 0}
			<section class="product-section" id="specs">
				<h2 class="product-section__title">Details</h2>
				{#if view.features.length > 0}
					<ul class="features">
						{#each view.features as feature (feature)}<li>{feature}</li>{/each}
					</ul>
				{/if}
				{#each view.specs as group (group.name)}
					<table class="specs">
						<caption>{group.name}</caption>
						<tbody>
							{#each group.rows as row (row.label)}
								<tr><th scope="row">{row.label}</th><td>{row.value}</td></tr>
							{/each}
						</tbody>
					</table>
				{/each}
			</section>
		{/if}

		{#if data.addons.length > 0}
			<section class="product-section">
				<h2 class="product-section__title">Complete your purchase</h2>
				<div class="addon-grid">
					{#each data.addons as addon (addon.id)}
						<div class="addon-card bd-card">
							<div class="addon-card__media">
								{#if addon.imageUrl}
									<img
										src={addon.imageUrl}
										alt={addon.addonName}
										loading="lazy"
										referrerpolicy="no-referrer"
									/>
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
								class="bd-btn bd-btn--ghost addon-card__add"
								onclick={() => handleAddAddon(addon)}
								disabled={addingAddon === addon.id || addedAddons[addon.id]}
							>
								{addedAddons[addon.id] ? 'Added' : addingAddon === addon.id ? '…' : 'Add'}
							</button>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<section class="product-section" id="reviews">
			<h2 class="product-section__title">Reviews</h2>
			{#if data.reviews && data.reviews.items.length > 0}
				<p class="reviews__summary">
					{@render stars(data.reviews.avgRating)}
					<strong>{data.reviews.avgRating.toFixed(1)} out of 5</strong>
					<span>from {data.reviews.totalCount} reviews</span>
				</p>
				<div class="review-list">
					{#each data.reviews.items as review (review.id)}
						{@const body = text(review.content) || text(review.body)}
						<article class="review">
							<div class="review__head">
								{@render stars(review.rating)}
								<span class="review__name">{text(review.reviewerName) || 'Verified buyer'}</span>
								<span class="review__date">{reviewDate(review.createdAt)}</span>
							</div>
							{#if text(review.title)}<p class="review__title">{text(review.title)}</p>{/if}
							{#if body}<p class="review__body">{body}</p>{/if}
						</article>
					{/each}
				</div>
				{#if moreReviews}
					<a
						class="bd-btn bd-btn--ghost reviews__more"
						href={`?reviews=${data.reviewLimit + 10}#reviews`}
						data-sveltekit-noscroll>Show more reviews</a
					>
				{/if}
			{:else}
				<p class="reviews__none">No reviews yet.</p>
			{/if}
		</section>

		<ProductRail title="You may also like" products={related} />
		<ProductRail title="Recently viewed" products={recent} />
		<CompareBar />
	{/if}
</main>

<Footer />

<style>
	.crumbs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		font-size: 0.88rem;
		color: var(--text-muted);
	}
	.crumbs a {
		border-bottom: none;
	}
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
		.gallery {
			position: sticky;
			top: 5.5rem;
		}
	}
	.gallery__main {
		position: relative;
		overflow: hidden;
		border-radius: 1rem;
		background: var(--bg-soft);
		aspect-ratio: 1;
	}
	.gallery__main img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.gallery__placeholder {
		display: grid;
		place-items: center;
		height: 100%;
		color: var(--text-muted);
	}
	.gallery__step {
		position: absolute;
		top: 50%;
		translate: 0 -50%;
		width: 2.5rem;
		height: 2.5rem;
		border: none;
		border-radius: 9999px;
		background: var(--glass-card);
		color: var(--title);
		font-size: 1.4rem;
		cursor: pointer;
	}
	.gallery__step--prev {
		left: 0.75rem;
	}
	.gallery__step--next {
		right: 0.75rem;
	}
	.gallery__thumbs {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.75rem;
		overflow-x: auto;
	}
	.gallery__thumb {
		flex: 0 0 4.5rem;
		height: 4.5rem;
		padding: 0;
		border: 2px solid transparent;
		border-radius: 0.6rem;
		overflow: hidden;
		background: var(--bg-soft);
		cursor: pointer;
	}
	.gallery__thumb--on {
		border-color: var(--accent);
	}
	.gallery__thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.product-detail__info {
		padding: 2rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.product-detail__info h1 {
		font-size: clamp(1.6rem, 3vw, 2.1rem);
	}
	.product-detail__eyebrow {
		margin: 0 0 0.25rem;
		color: var(--accent);
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.product-detail__rating {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.5rem;
		font-size: 0.9rem;
		color: var(--text-muted);
		border-bottom: none;
	}
	.product-detail__price {
		margin: 0;
		color: var(--title);
		font-size: 1.6rem;
		font-weight: 700;
	}
	.product-detail__from,
	.product-detail__each {
		color: var(--text-muted);
		font-size: 0.9rem;
		font-weight: 500;
	}
	.product-detail__desc {
		margin: 0;
		color: var(--text);
		white-space: pre-line;
	}
	.product-detail__stock {
		margin: 0;
		color: var(--danger);
		font-size: 0.9rem;
		font-weight: 600;
	}
	.choice {
		margin: 0;
		padding: 0;
		border: none;
	}
	.choice__picked {
		margin-left: 0.4rem;
		color: var(--text-muted);
		font-weight: 500;
	}
	.choice__values {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.choice__value {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		min-width: 3rem;
		padding: 0.5rem 0.85rem;
		border: 1px solid var(--border-strong);
		border-radius: 0.6rem;
		background: var(--card);
		color: var(--title);
		font: inherit;
		font-size: 0.9rem;
		cursor: pointer;
	}
	.choice__value small {
		color: var(--text-muted);
		font-size: 0.75rem;
	}
	.choice__value--on {
		border-color: var(--accent);
		box-shadow: 0 0 0 1px var(--accent);
	}
	.choice__value:disabled {
		opacity: 0.45;
		text-decoration: line-through;
		cursor: not-allowed;
	}
	.buy {
		display: flex;
		gap: 0.75rem;
		align-items: stretch;
	}
	.qty {
		display: inline-flex;
		align-items: center;
		border: 1px solid var(--border-strong);
		border-radius: 9999px;
	}
	.qty button {
		width: 2.5rem;
		height: 100%;
		min-height: 2.75rem;
		border: none;
		background: none;
		color: var(--title);
		font-size: 1.1rem;
		cursor: pointer;
	}
	.qty button:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.qty span {
		min-width: 1.75rem;
		text-align: center;
		font-weight: 600;
		color: var(--title);
	}
	.buy__add {
		flex: 1;
		justify-content: center;
	}
	.product-detail__tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}
	.share {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.45rem 0.8rem;
		border: 1px solid var(--border-strong);
		border-radius: 9999px;
		background: var(--card);
		color: var(--title);
		font: inherit;
		font-size: 0.85rem;
		cursor: pointer;
	}
	.share__note {
		color: var(--success);
		font-size: 0.85rem;
	}
	.policies {
		margin: 0;
		padding: 1rem 0 0;
		border-top: 1px solid var(--border);
		list-style: none;
		display: grid;
		gap: 0.35rem;
		color: var(--text-muted);
		font-size: 0.85rem;
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
	.features {
		display: grid;
		gap: 0.4rem;
		margin: 0 0 1.5rem;
		padding-left: 1.2rem;
		color: var(--text);
	}
	.specs {
		width: 100%;
		max-width: 44rem;
		margin-bottom: 1.5rem;
		border-collapse: collapse;
		font-size: 0.92rem;
	}
	.specs caption {
		padding-bottom: 0.5rem;
		text-align: left;
		color: var(--title);
		font-weight: 700;
	}
	.specs th,
	.specs td {
		padding: 0.6rem 0.75rem;
		border-top: 1px solid var(--border);
		text-align: left;
		vertical-align: top;
	}
	.specs th {
		width: 40%;
		color: var(--text-muted);
		font-weight: 500;
	}
	.reviews__summary {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
		color: var(--text-muted);
	}
	.reviews__summary strong {
		color: var(--title);
	}
	.reviews__more {
		margin-top: 1rem;
	}
	.reviews__none {
		color: var(--text-muted);
	}
	.review__date {
		margin-left: auto;
		color: var(--text-muted);
		font-size: 0.8rem;
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
</style>
