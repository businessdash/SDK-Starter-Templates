<!-- [bd-file:store] -->
<script lang="ts">
	/**
	 * Save a product to the wishlist, or add it to the compare table. Both
	 * lists live in this browser (see `#lib/bd/shop.ts`), so the buttons only
	 * know their state once the page is in the browser.
	 */
	import { onMount } from 'svelte';
	import { compareList, wishlist, type SavedProduct } from '#lib/bd/shop.ts';

	let { product, compact = false }: { product: SavedProduct; compact?: boolean } = $props();

	let saved = $state(false);
	let comparing = $state(false);
	let compareFull = $state(false);

	onMount(() => {
		const sync = () => {
			saved = wishlist.has(product.id);
			comparing = compareList.has(product.id);
			compareFull = !comparing && compareList.read().length >= compareList.limit;
		};
		sync();
		const offWish = wishlist.subscribe(sync);
		const offCompare = compareList.subscribe(sync);
		return () => {
			offWish();
			offCompare();
		};
	});

	// Inside a product card (a link), a button press must not follow it.
	function press(event: MouseEvent, action: () => void) {
		event.preventDefault();
		event.stopPropagation();
		action();
	}
</script>

<div class="save-buttons" class:save-buttons--compact={compact}>
	<button
		type="button"
		class="save-buttons__btn"
		class:save-buttons__btn--on={saved}
		aria-pressed={saved}
		aria-label={saved
			? `Remove ${product.name} from your wishlist`
			: `Save ${product.name} to your wishlist`}
		onclick={(e) => press(e, () => wishlist.toggle(product))}
	>
		<span aria-hidden="true">{saved ? '♥' : '♡'}</span>
		{#if !compact}{saved ? 'Saved' : 'Save'}{/if}
	</button>
	<button
		type="button"
		class="save-buttons__btn"
		class:save-buttons__btn--on={comparing}
		aria-pressed={comparing}
		disabled={compareFull}
		title={compareFull ? `The compare table holds ${compareList.limit}` : undefined}
		aria-label={comparing ? `Remove ${product.name} from compare` : `Compare ${product.name}`}
		onclick={(e) => press(e, () => compareList.toggle(product))}
	>
		<span aria-hidden="true">⇄</span>
		{#if !compact}{comparing ? 'Comparing' : 'Compare'}{/if}
	</button>
</div>

<style>
	.save-buttons {
		display: flex;
		gap: 0.5rem;
	}
	.save-buttons__btn {
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
	.save-buttons--compact .save-buttons__btn {
		width: 2.2rem;
		height: 2.2rem;
		padding: 0;
		justify-content: center;
	}
	.save-buttons__btn--on {
		border-color: var(--accent);
		background: var(--accent-bg);
		color: var(--accent);
	}
	.save-buttons__btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.save-buttons__btn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
</style>
