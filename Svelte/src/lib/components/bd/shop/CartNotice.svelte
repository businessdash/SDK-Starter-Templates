<!-- [bd-file:store] -->
<script lang="ts">
	/** After adding: "Added 2 to your cart." with View cart, or what went wrong. */
	let {
		message,
		cartHref = '/store/cart'
	}: { message: { kind: 'ok' | 'error'; text: string } | null; cartHref?: string } = $props();
</script>

{#if message}
	<div
		class="product-detail__msg"
		class:product-detail__msg--err={message.kind === 'error'}
		role="status"
	>
		{message.text}
		{#if message.kind === 'ok'}
			<a class="bd-btn bd-btn--ghost" href={cartHref}>View cart</a>
		{/if}
	</div>
{/if}

<style>
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
</style>
