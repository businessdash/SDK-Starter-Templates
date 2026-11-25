<!-- [bd-file:store] -->
<script lang="ts">
	/** Clear all filters. */
	let { onClear }: { onClear: () => void } = $props();
</script>

<button type="button" class="store-clear" onclick={onClear}> Clear all filters </button>

<style>
	.store-clear {
		align-self: flex-start;
		background: transparent;
		border: none;
		padding: 0;
		color: var(--accent);
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.store-clear:hover {
		color: var(--accent-strong);
	}
</style>
