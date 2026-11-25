<script lang="ts">
	import Header from '#lib/components/bd/Header.svelte';
	import Footer from '#lib/components/bd/Footer.svelte';
	import ReviewWriter from '#lib/components/bd/ReviewWriter.svelte';
	import RatingSummary from '#lib/components/bd/reviews/RatingSummary.svelte';
	import ReviewCard from '#lib/components/bd/reviews/ReviewCard.svelte';
	import ReviewFilter from '#lib/components/bd/reviews/ReviewFilter.svelte';
	import { sourceLabel } from '#lib/bd/reviews.ts';
	import '#lib/bd/bd-reviews.css';
	import type { PageData } from './$types';

	/**
	 * The business's reviews, laid out from the parts in
	 * `#lib/components/bd/reviews/`: the rating with a bar per star, a
	 * platform filter, a review card per review, "Show more", and writing one
	 * (ReviewWriter).
	 */
	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Reviews</title></svelte:head>

<Header />

<main class="bd-section bd-section--narrow">
	<div class="bd-section__lead">
		<span class="bd-section__eyebrow">Reviews</span>
		<h1 class="bd-section__title">What customers say</h1>
	</div>

	{#if !data.configured}
		<div class="bd-empty">
			Reviews aren't connected yet. Set BD_API_KEY and BD_SITE_ID, and your rating and reviews
			appear here.
		</div>
	{:else}
		<RatingSummary summary={data.summary}>
			<ReviewWriter signedIn={data.signedIn} signInHref="/my-account?next=%2Freviews" />
		</RatingSummary>
		<ReviewFilter sources={data.sources} selected={data.source} />

		{#if data.reviews.length === 0}
			<p class="reviews-empty">
				{data.source
					? `No ${sourceLabel(data.source)} reviews yet.`
					: "No reviews yet. Connect Google or Yelp in BusinessDash, or add reviews in the dashboard, and they'll appear here."}
			</p>
		{:else}
			<ul class="review-wall">
				{#each data.reviews as review, i (review.id)}
					<ReviewCard {review} id={`review-${i}`} />
				{/each}
			</ul>
			{#if data.moreHref}
				<p class="reviews-more">
					<a class="bd-btn bd-btn--ghost" href={data.moreHref}>Show more reviews</a>
				</p>
			{/if}
		{/if}
	{/if}
</main>

<Footer />
