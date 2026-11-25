<script setup lang="ts">
/**
 * The average with its stars and how many reviews, then a bar per star.
 * Anything in its slot (the review writer, on the reviews page) shows
 * beside it.
 */
import { computed } from "vue";
import { reviewStars, type ReviewSummary } from "#shared/bd/reviews";

const props = defineProps<{ summary: ReviewSummary }>();
const average = computed(() => props.summary.average?.toFixed(1) ?? null);
</script>

<template>
	<section class="reviews-summary" :aria-label="average ? 'Rating' : 'Write a review'">
		<template v-if="average">
			<div class="reviews-summary__score">
				<span class="reviews-summary__average">{{ average }}</span>
				<span class="review-stars" role="img" :aria-label="`${average} out of 5`">{{
					reviewStars(summary.average ?? 0)
				}}</span>
				<span class="reviews-summary__count"
					>{{ summary.total }} {{ summary.total === 1 ? "review" : "reviews" }}</span
				>
			</div>
			<ul class="reviews-bars">
				<li
					v-for="row in summary.histogram"
					:key="row.stars"
					:aria-label="`${row.stars} stars: ${row.count}`"
				>
					<span>{{ row.stars }} ★</span>
					<span class="reviews-bars__track"
						><span class="reviews-bars__fill" :style="{ width: `${Math.round(row.share * 100)}%` }"
					/></span>
					<span>{{ row.count }}</span>
				</li>
			</ul>
		</template>
		<div v-if="$slots.default" class="reviews-summary__write">
			<slot />
		</div>
	</section>
</template>
