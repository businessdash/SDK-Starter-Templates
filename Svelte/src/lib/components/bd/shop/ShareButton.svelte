<!-- [bd-file:store] -->
<script lang="ts">
	/** ↗ Share: the share sheet, or the link copied ("Link copied"). */
	import { shareLink } from '#lib/bd/shop.ts';

	let { url, title }: { url: string; title: string } = $props();
	let note = $state('');

	async function share() {
		const result = await shareLink(url, title);
		note = result === 'copied' ? 'Link copied' : result === 'failed' ? "Couldn't share" : '';
		if (note) setTimeout(() => (note = ''), 2500);
	}
</script>

<button type="button" class="share" onclick={share}>
	<span aria-hidden="true">↗</span> Share
</button>
{#if note}<span class="share__note" role="status">{note}</span>{/if}

<style>
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
</style>
