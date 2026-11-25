<!-- [bd-file:store] -->
<script lang="ts">
	/** "Only 3 left", at five or fewer. */
	let { stock }: { stock: number | null | undefined } = $props();
</script>

{#if stock != null && stock > 0 && stock <= 5}
	<p class="product-detail__stock">Only {stock} left</p>
{/if}

<style>
	.product-detail__stock {
		margin: 0;
		color: var(--danger);
		font-size: 0.9rem;
		font-weight: 600;
	}
</style>
