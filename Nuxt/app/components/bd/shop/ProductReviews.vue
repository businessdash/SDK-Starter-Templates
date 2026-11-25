<!-- [bd-file:store] -->
<script setup lang="ts">
/** The product's reviews: the average, each review, and Show more reviews (`moreTo`). */
import type { RouteLocationRaw } from "vue-router";
import StarRating from "~/components/bd/StarRating.vue";
import type { StoreProductResult } from "../../../../server/api/bd/store/product/[id].get";

defineProps<{ reviews: StoreProductResult["reviews"]; moreTo?: RouteLocationRaw | null }>();

function text(value: unknown): string {
	return typeof value === "string" ? value : "";
}
function reviewDate(iso: unknown): string {
	const date = typeof iso === "string" ? new Date(iso) : null;
	return date && !Number.isNaN(date.getTime())
		? date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
		: "";
}
</script>

<template>
	<section id="reviews" class="product-section">
		<h2 class="product-section__title">Reviews</h2>
		<template v-if="reviews && reviews.items.length > 0">
			<p class="reviews__summary">
				<StarRating :rating="reviews.avgRating" />
				<strong>{{ reviews.avgRating.toFixed(1) }} out of 5</strong>
				<span>from {{ reviews.totalCount }} reviews</span>
			</p>
			<div class="review-list">
				<article v-for="review in reviews.items" :key="review.id" class="review">
					<div class="review__head">
						<StarRating :rating="review.rating" />
						<span class="review__name">
							{{ text(review.reviewerName) || "Verified buyer" }}
						</span>
						<span class="review__date">{{ reviewDate(review.createdAt) }}</span>
					</div>
					<p v-if="text(review.title)" class="review__title">{{ text(review.title) }}</p>
					<p v-if="text(review.content) || text(review.body)" class="review__body">
						{{ text(review.content) || text(review.body) }}
					</p>
				</article>
			</div>
			<NuxtLink v-if="moreTo" class="bd-btn bd-btn--ghost reviews__more" :to="moreTo">
				Show more reviews
			</NuxtLink>
		</template>
		<p v-else class="reviews__none">No reviews yet.</p>
	</section>
</template>
