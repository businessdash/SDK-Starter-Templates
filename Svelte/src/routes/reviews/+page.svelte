<script lang="ts">
	import Header from '#lib/components/bd/Header.svelte';
	import Footer from '#lib/components/bd/Footer.svelte';
	import ReviewWriter from '#lib/components/bd/ReviewWriter.svelte';
	import {
		formatReviewDate,
		platformName,
		reviewerInitial,
		reviewerName,
		reviewLink,
		reviewStars,
		safeImage,
		sourceLabel
	} from '#lib/bd/reviews.ts';
	import '#lib/bd/bd-reviews.css';
	import type { PageData } from './$types';

	/**
	 * The business's reviews: the rating with a bar per star, a platform
	 * filter, each review with its photos, Verified and a link to it on Google
	 * or Yelp, "Show more", and writing one (ReviewWriter).
	 */
	let { data }: { data: PageData } = $props();

	const average = $derived(data.summary.average?.toFixed(1) ?? null);
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
		<section class="reviews-summary" aria-label={average ? 'Rating' : 'Write a review'}>
			{#if average}
				<div class="reviews-summary__score">
					<span class="reviews-summary__average">{average}</span>
					<span class="review-stars" role="img" aria-label={`${average} out of 5`}
						>{reviewStars(data.summary.average ?? 0)}</span
					>
					<span class="reviews-summary__count"
						>{data.summary.total} {data.summary.total === 1 ? 'review' : 'reviews'}</span
					>
				</div>
				<ul class="reviews-bars">
					{#each data.summary.histogram as row (row.stars)}
						<li aria-label={`${row.stars} stars: ${row.count}`}>
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
			<div class="reviews-summary__write">
				<ReviewWriter signedIn={data.signedIn} signInHref="/my-account?next=%2Freviews" />
			</div>
		</section>

		{#if data.sources.length > 1}
			<nav aria-label="Platform">
				<ul class="reviews-filter">
					<li><a href="/reviews" aria-current={data.source ? 'false' : 'true'}>All</a></li>
					{#each data.sources as source (source)}
						<li>
							<a
								href={`/reviews?source=${source}`}
								aria-current={data.source === source ? 'true' : 'false'}>{sourceLabel(source)}</a
							>
						</li>
					{/each}
				</ul>
			</nav>
		{/if}

		{#if data.reviews.length === 0}
			<p class="reviews-empty">
				{data.source
					? `No ${sourceLabel(data.source)} reviews yet.`
					: "No reviews yet. Connect Google or Yelp in BusinessDash, or add reviews in the dashboard, and they'll appear here."}
			</p>
		{:else}
			<ul class="review-wall">
				{#each data.reviews as review, i (review.id)}
					{@const avatar = safeImage(review.reviewerImageUrl)}
					{@const platform = platformName(review.source)}
					{@const link = reviewLink(review)}
					{@const photos = (review.photos ?? []).map(safeImage).filter((p) => p !== null)}
					<li class="review-card" id={`review-${i}`}>
						<div class="review-card__head">
							{#if avatar}
								<img class="review-card__avatar" src={avatar} alt="" loading="lazy" />
							{:else}
								<span class="review-card__avatar" aria-hidden="true">{reviewerInitial(review)}</span
								>
							{/if}
							<div>
								<p class="review-card__name">{reviewerName(review)}</p>
								<p class="review-card__meta">
									<span class="review-stars" role="img" aria-label={`${review.rating} out of 5`}
										>{reviewStars(review.rating)}</span
									>
									· {formatReviewDate(review.timeCreated)}
								</p>
							</div>
						</div>
						<p class="review-card__text">{review.text}</p>
						{#if photos.length}
							<ul class="review-card__photos" aria-label="Photos from the reviewer">
								{#each photos as photo (photo)}<li>
										<img src={photo} alt="" loading="lazy" />
									</li>{/each}
							</ul>
						{/if}
						{#if platform || review.verified}
							<p class="review-card__foot">
								{#if platform}<span class="review-card__platform">{platform}</span>{/if}
								{#if review.verified}<span class="review-card__verified">✓ Verified</span>{/if}
								{#if link && platform}
									<a class="review-card__link" href={link} target="_blank" rel="noopener noreferrer"
										>Read on {platform}</a
									>
								{/if}
							</p>
						{/if}
					</li>
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
