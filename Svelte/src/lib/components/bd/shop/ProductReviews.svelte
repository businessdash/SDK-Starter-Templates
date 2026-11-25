<!-- [bd-file:store] -->
<script lang="ts">
	/** The product's reviews: the average, each review, and Show more reviews (`moreHref`). */
	import type { StorefrontProductReviewsResponse } from '@businessdash/sdk/contracts';
	import StarRating from './StarRating.svelte';

	let {
		reviews,
		moreHref = null
	}: { reviews: StorefrontProductReviewsResponse | null; moreHref?: string | null } = $props();

	function text(v: unknown): string {
		return typeof v === 'string' ? v : '';
	}
	function reviewDate(iso: unknown): string {
		const date = typeof iso === 'string' ? new Date(iso) : null;
		return date && !Number.isNaN(date.getTime())
			? date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
			: '';
	}
</script>

<section class="product-section" id="reviews">
	<h2 class="product-section__title">Reviews</h2>
	{#if reviews && reviews.items.length > 0}
		<p class="reviews__summary">
			<StarRating rating={reviews.avgRating} />
			<strong>{reviews.avgRating.toFixed(1)} out of 5</strong>
			<span>from {reviews.totalCount} reviews</span>
		</p>
		<div class="review-list">
			{#each reviews.items as review (review.id)}
				{@const body = text(review.content) || text(review.body)}
				<article class="review">
					<div class="review__head">
						<StarRating rating={review.rating} />
						<span class="review__name">{text(review.reviewerName) || 'Verified buyer'}</span>
						<span class="review__date">{reviewDate(review.createdAt)}</span>
					</div>
					{#if text(review.title)}<p class="review__title">{text(review.title)}</p>{/if}
					{#if body}<p class="review__body">{body}</p>{/if}
				</article>
			{/each}
		</div>
		{#if moreHref}
			<a class="bd-btn bd-btn--ghost reviews__more" href={moreHref} data-sveltekit-noscroll
				>Show more reviews</a
			>
		{/if}
	{:else}
		<p class="reviews__none">No reviews yet.</p>
	{/if}
</section>

<style>
	.product-section {
		margin-top: 3rem;
	}
	.product-section__title {
		font-size: 1.4rem;
		margin-bottom: 1.25rem;
	}
	.reviews__summary {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
		color: var(--text-muted);
	}
	.reviews__summary strong {
		color: var(--title);
	}
	.reviews__more {
		margin-top: 1rem;
	}
	.reviews__none {
		color: var(--text-muted);
	}
	.review-list {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.review {
		padding-bottom: 1.25rem;
		border-bottom: 1px solid var(--border);
	}
	.review__head {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.review__name {
		font-weight: 600;
		color: var(--title);
		font-size: 0.9rem;
	}
	.review__date {
		margin-left: auto;
		color: var(--text-muted);
		font-size: 0.8rem;
	}
	.review__title {
		margin-top: 0.4rem;
		font-weight: 600;
		color: var(--title);
		font-size: 0.92rem;
	}
	.review__body {
		margin-top: 0.25rem;
		color: var(--text-muted);
		font-size: 0.92rem;
		line-height: 1.55;
	}
</style>
