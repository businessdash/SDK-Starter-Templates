<script lang="ts">
	/**
	 * The average with its stars and how many reviews, then a bar per star.
	 * Anything you put inside (the review writer, on the reviews page) shows
	 * beside it.
	 */
	import type { Snippet } from 'svelte';
	import { reviewStars, type ReviewSummary } from '#lib/bd/reviews.ts';

	let { summary, children }: { summary: ReviewSummary; children?: Snippet } = $props();

	const average = $derived(summary.average?.toFixed(1) ?? null);
</script>

<section class="reviews-summary" aria-label={average ? 'Rating' : 'Write a review'}>
	{#if average}
		<div class="reviews-summary__score">
			<span class="reviews-summary__average">{average}</span>
			<span class="review-stars" role="img" aria-label={`${average} out of 5`}
				>{reviewStars(summary.average ?? 0)}</span
			>
			<span class="reviews-summary__count"
				>{summary.total} {summary.total === 1 ? 'review' : 'reviews'}</span
			>
		</div>
		<ul class="reviews-bars">
			{#each summary.histogram as row (row.stars)}
				<li aria-label={`${row.stars} ${row.stars === 1 ? 'star' : 'stars'}: ${row.count}`}>
					<span>{row.stars} ★</span>
					<span class="reviews-bars__track"
						><span class="reviews-bars__fill" style:width={`${Math.round(row.share * 100)}%`}
						></span></span
					>
					<span>{row.count}</span>
				</li>
			{/each}
		</ul>
	{/if}
	{#if children}
		<div class="reviews-summary__write">{@render children()}</div>
	{/if}
</section>
