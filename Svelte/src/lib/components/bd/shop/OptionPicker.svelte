<!-- [bd-file:store] -->
<script lang="ts">
	/** One option group (Size, Colour…): a button per value, the chosen value's name beside the title. */
	import type { OptionGroup } from '#lib/bd/shop.ts';

	let {
		group,
		chosen,
		onPick
	}: { group: OptionGroup; chosen: string | undefined; onPick: (valueId: string) => void } =
		$props();
</script>

<fieldset class="choice">
	<legend class="bd-label">
		{group.title}
		{#if chosen}
			<span class="choice__picked">
				{group.values.find((v) => v.id === chosen)?.value}
			</span>
		{/if}
	</legend>
	<div class="choice__values">
		{#each group.values as value (value.id)}
			<button
				type="button"
				class="choice__value"
				class:choice__value--on={chosen === value.id}
				aria-pressed={chosen === value.id}
				disabled={!value.available}
				title={value.available ? undefined : 'Sold out'}
				onclick={() => onPick(value.id)}
			>
				{value.value}
			</button>
		{/each}
	</div>
</fieldset>

<style>
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
