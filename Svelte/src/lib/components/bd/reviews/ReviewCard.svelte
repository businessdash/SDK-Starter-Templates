<script lang="ts">
	/**
	 * One review: the reviewer's photo or initial, name, stars and date, what
	 * they wrote, their photos, the platform, Verified, and a link to it there.
	 */
	import {
		formatReviewDate,
		platformName,
		reviewerInitial,
		reviewerName,
		reviewLink,
		reviewStars,
		safeImage,
		type WallReview
	} from '#lib/bd/reviews.ts';

	let { review, id }: { review: WallReview; id?: string } = $props();

	const avatar = $derived(safeImage(review.reviewerImageUrl));
	const platform = $derived(platformName(review.source));
	const link = $derived(reviewLink(review));
	const photos = $derived((review.photos ?? []).map(safeImage).filter((p) => p !== null));
</script>

<li class="review-card" {id}>
	<div class="review-card__head">
		{#if avatar}
			<img class="review-card__avatar" src={avatar} alt="" loading="lazy" />
		{:else}
			<span class="review-card__avatar" aria-hidden="true">{reviewerInitial(review)}</span>
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
