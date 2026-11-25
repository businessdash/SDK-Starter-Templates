<!-- [bd-file:store] -->
<script lang="ts">
	/**
	 * A button per variant (Cloud, Storm…), the chosen one pressed; sold-out
	 * ones can't be pressed. Nothing shows for a product with one variant. A
	 * variant's price shows on its button while it has no options of its own.
	 */
	import { formatDollars, type ProductVariant } from '#lib/bd/shop.ts';

	let {
		variants,
		selected,
		showPrices,
		onPick
	}: {
		variants: ProductVariant[];
		selected: string;
		showPrices: boolean;
		onPick: (variantId: string) => void;
	} = $props();
</script>

{#if variants.length > 1}
	<fieldset class="choice">
		<legend class="bd-label">Option</legend>
		<div class="choice__values">
			{#each variants as v (v.id)}
				<button
					type="button"
					class="choice__value"
					class:choice__value--on={v.id === selected}
					aria-pressed={v.id === selected}
					disabled={!v.available}
					onclick={() => onPick(v.id)}
				>
					{v.name}
					{#if v.price != null && showPrices}
						<small>{formatDollars(v.price)}</small>
					{/if}
				</button>
			{/each}
		</div>
	</fieldset>
{/if}

<style>
	.choice {
		margin: 0;
		padding: 0;
		border: none;
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
</style>
