<script setup lang="ts">
/**
 * One review: the reviewer's photo or initial, name, stars and date, what
 * they wrote, their photos, the platform, Verified, and a link to it there.
 */
import { computed } from "vue";
import {
	formatReviewDate,
	platformName,
	reviewerInitial,
	reviewerName,
	reviewLink,
	reviewStars,
	safeImage,
	type WallReview,
} from "#shared/bd/reviews";

const props = defineProps<{ review: WallReview }>();

const avatar = computed(() => safeImage(props.review.reviewerImageUrl));
const platform = computed(() => platformName(props.review.source));
const link = computed(() => reviewLink(props.review));
const photos = computed(() =>
	(props.review.photos ?? []).map(safeImage).filter((p): p is string => p !== null),
);
</script>

<template>
	<li class="review-card">
		<div class="review-card__head">
			<img v-if="avatar" class="review-card__avatar" :src="avatar" alt="" loading="lazy" />
			<span v-else class="review-card__avatar" aria-hidden="true">{{
				reviewerInitial(review)
			}}</span>
			<div>
				<p class="review-card__name">{{ reviewerName(review) }}</p>
				<p class="review-card__meta">
					<span class="review-stars" role="img" :aria-label="`${review.rating} out of 5`">{{
						reviewStars(review.rating)
					}}</span>
					· {{ formatReviewDate(review.timeCreated) }}
				</p>
			</div>
		</div>
		<p class="review-card__text">{{ review.text }}</p>
		<ul v-if="photos.length" class="review-card__photos" aria-label="Photos from the reviewer">
			<li v-for="photo in photos" :key="photo"><img :src="photo" alt="" loading="lazy" /></li>
		</ul>
		<p v-if="platform || review.verified" class="review-card__foot">
			<span v-if="platform" class="review-card__platform">{{ platform }}</span>
			<span v-if="review.verified" class="review-card__verified">✓ Verified</span>
			<a
				v-if="link && platform"
				class="review-card__link"
				:href="link"
				target="_blank"
				rel="noopener noreferrer"
				>Read on {{ platform }}</a
			>
		</p>
	</li>
</template>
