<script lang="ts">
	import Header from '$lib/components/biab/Header.svelte';
	import Footer from '$lib/components/biab/Footer.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function formatDate(iso: string | null): string {
		if (!iso) return '';
		const d = new Date(iso);
		return Number.isNaN(d.getTime())
			? ''
			: d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
	}
</script>

<svelte:head><title>Updates</title></svelte:head>

<Header />

<main class="biab-section biab-section--narrow">
	<div class="biab-section__lead">
		<span class="biab-section__eyebrow">News</span>
		<h1 class="biab-section__title">Updates</h1>
		<p class="biab-section__sub">
			Recent posts, syncing from the business profile via BIAB.
		</p>
	</div>

	{#if data.unavailable}
		<div class="biab-empty">Updates are temporarily unavailable.</div>
	{:else if data.updates.length === 0}
		<div class="biab-empty">
			No updates yet. Posts from the connected business profile will appear here.
		</div>
	{:else}
		<div class="updates-list">
			{#each data.updates as update (update.id)}
				<article class="biab-card update-card">
					{#if update.imageUrl}
						<img class="update-card__img" src={update.imageUrl} alt={update.title ?? 'Update'} loading="lazy" />
					{/if}
					<div class="update-card__body">
						{#if update.title}<h3>{update.title}</h3>{/if}
						<p>{update.body}</p>
						<div class="update-card__meta">
							{#if update.postedAt}<span>{formatDate(update.postedAt)}</span>{/if}
							{#if update.kind}<span class="biab-badge">{update.kind}</span>{/if}
							{#if update.link}<a href={update.link} target="_blank" rel="noreferrer">Learn more →</a>{/if}
						</div>
					</div>
				</article>
			{/each}
		</div>
	{/if}
</main>

<Footer />

<style>
	.updates-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.update-card {
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.update-card__img {
		width: 100%;
		max-height: 18rem;
		object-fit: cover;
	}
	.update-card__body {
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.update-card__meta {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: var(--text-muted);
		font-size: 0.8rem;
	}
</style>
