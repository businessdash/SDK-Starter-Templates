<!-- [bd-file:store] -->
<script lang="ts">
	/**
	 * "Complete your purchase": add-ons, each with Add. `onAdded` gets the
	 * cart's new item count after one is added.
	 */
	import type { StorefrontAddonsResponse } from '@businessdash/sdk/contracts';
	import { addToCart } from '#lib/bd/cart-client.ts';
	import { formatCents } from '#lib/bd/shop.ts';

	type Addon = StorefrontAddonsResponse['items'][number];

	let { addons, onAdded }: { addons: Addon[]; onAdded?: (itemCount: number) => void } = $props();

	let adding = $state<string | null>(null);
	let added = $state<Record<string, boolean>>({});

	/** First purchasable variant id of an addon, for its "Add" button. */
	function firstVariantId(variants: unknown): string | undefined {
		if (!Array.isArray(variants)) return undefined;
		const first = variants[0] as { variantId?: unknown; id?: unknown } | undefined;
		const id = first?.variantId ?? first?.id;
		return typeof id === 'string' ? id : undefined;
	}

	async function add(addon: Addon) {
		adding = addon.id;
		const res = await addToCart({
			productId: addon.addonProductId,
			variantId: firstVariantId(addon.variants),
			quantity: 1
		});
		adding = null;
		if (res.ok) {
			onAdded?.(res.snapshot.itemCount);
			added = { ...added, [addon.id]: true };
		}
	}
</script>

{#if addons.length > 0}
	<section class="product-section">
		<h2 class="product-section__title">Complete your purchase</h2>
		<div class="addon-grid">
			{#each addons as addon (addon.id)}
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
						onclick={() => add(addon)}
						disabled={adding === addon.id || added[addon.id]}
					>
						{added[addon.id] ? 'Added' : adding === addon.id ? '…' : 'Add'}
					</button>
				</div>
			{/each}
		</div>
	</section>
{/if}

<style>
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
</style>
