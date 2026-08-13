<script lang="ts">
	import Header from '$lib/components/biab/Header.svelte';
	import Footer from '$lib/components/biab/Footer.svelte';
	import type { ReviewWallItem } from '@businessdash/sdk/contracts';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Seed local state from the server's first page, then grow it via "Load
	// more". Intentionally a one-time snapshot of `data`.
	// svelte-ignore state_referenced_locally
	let items = $state<ReviewWallItem[]>(data.items);
	// svelte-ignore state_referenced_locally
	let nextOffset = $state<number | null>(data.nextOffset);
	let loading = $state(false);

	function stars(rating: number): string {
		const full = Math.round(rating);
		return '★'.repeat(full) + '☆'.repeat(Math.max(0, 5 - full));
	}

	function formatDate(iso: string): string {
		const d = new Date(iso);
		return Number.isNaN(d.getTime())
			? ''
			: d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
	}

	async function loadMore() {
		if (nextOffset == null) return;
		loading = true;
		try {
			const res = await fetch(`/api/biab/reviews?limit=10&offset=${nextOffset}`);
			const body = (await res.json()) as {
				items: ReviewWallItem[];
				nextOffset: number | null;
			};
			items = [...items, ...body.items];
			nextOffset = body.nextOffset;
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head><title>Reviews</title></svelte:head>

<Header />

<main class="biab-section biab-section--narrow">
	<div class="biab-section__lead">
		<span class="biab-section__eyebrow">What customers say</span>
		<h1 class="biab-section__title">Reviews</h1>
		{#if data.average != null}
			<p class="biab-section__sub">
				<strong>{data.average.toFixed(1)}</strong>
				average across {data.totalCount} reviews.
			</p>
		{/if}
	</div>

	{#if !data.configured}
		<div class="biab-empty">
			Reviews aren't connected. Once BIAB is configured, your aggregate rating
			and reviews appear here.
		</div>
	{:else if items.length === 0}
		<div class="biab-empty">No reviews yet.</div>
	{:else}
		<div class="reviews-wall">
			{#each items as review (review.id)}
				<article class="biab-card review-card">
					<div class="review-card__head">
						<strong>{review.reviewerName}</strong>
						<span class="review-card__stars" aria-label={`${review.rating} out of 5`}>
							{stars(review.rating)}
						</span>
					</div>
					<p class="review-card__body">{review.text}</p>
					<div class="review-card__meta">
						<span>{formatDate(review.timeCreated)}</span>
						<span class="biab-badge">{review.source}</span>
						{#if review.verified}<span class="review-card__verified">Verified</span>{/if}
					</div>
				</article>
			{/each}
		</div>

		{#if nextOffset != null}
			<div style="text-align: center; margin-top: 2rem;">
				<button class="biab-btn biab-btn--ghost" onclick={loadMore} disabled={loading}>
					{loading ? 'Loading…' : 'Load more reviews'}
				</button>
			</div>
		{/if}
	{/if}
</main>

<Footer />

<style>
	.reviews-wall {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.review-card {
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.review-card__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	.review-card__stars {
		color: var(--accent);
		letter-spacing: 0.1em;
	}
	.review-card__body {
		color: var(--text);
	}
	.review-card__meta {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: var(--text-muted);
		font-size: 0.8rem;
	}
	.review-card__verified {
		color: var(--success);
		font-weight: 600;
	}
</style>
