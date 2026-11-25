<script setup lang="ts">
import { computed } from "vue";
import BdHeader from "~/components/bd/BdHeader.vue";
import BdFooter from "~/components/bd/BdFooter.vue";
import ReviewWriter from "~/components/bd/ReviewWriter.vue";
import {
	formatReviewDate,
	platformName,
	reviewerInitial,
	reviewerName,
	reviewLink,
	reviewStars,
	safeImage,
	sourceLabel,
} from "#shared/bd/reviews";
import type { ReviewsPageData } from "../../server/api/bd/reviews/page.get";

/**
 * The business's reviews: the rating with a bar per star, a platform
 * filter (`?source=`), each review with its photos, Verified and a link to
 * it on Google or Yelp, "Show more" (`?shown=`), and writing one
 * (ReviewWriter). The page's data is `/api/bd/reviews/page`.
 */
const route = useRoute();
const query = computed(() => ({ source: route.query.source, shown: route.query.shown }));
const { data } = await useFetch<ReviewsPageData>("/api/bd/reviews/page", { query });

const average = computed(() => data.value?.summary.average?.toFixed(1) ?? null);
const cards = computed(() =>
	(data.value?.reviews ?? []).map((review) => ({
		review,
		avatar: safeImage(review.reviewerImageUrl),
		platform: platformName(review.source),
		link: reviewLink(review),
		photos: (review.photos ?? []).map(safeImage).filter((p): p is string => p !== null),
	})),
);

useHead({ title: "Reviews — Your Business" });
</script>

<template>
	<div>
		<BdHeader />
		<main>
			<section class="bd-section bd-section--narrow">
				<div class="bd-section__lead">
					<span class="bd-section__eyebrow">Reviews</span>
					<h1 class="bd-section__title">What customers say</h1>
				</div>

				<div v-if="!data?.configured" class="bd-empty">
					Reviews aren't connected yet. Set BD_API_KEY and BD_SITE_ID, and your rating and reviews appear here.
				</div>
				<template v-else>
					<section class="reviews-summary" :aria-label="average ? 'Rating' : 'Write a review'">
						<template v-if="average">
							<div class="reviews-summary__score">
								<span class="reviews-summary__average">{{ average }}</span>
								<span class="review-stars" role="img" :aria-label="`${average} out of 5`">{{
									reviewStars(data.summary.average ?? 0)
								}}</span>
								<span class="reviews-summary__count"
									>{{ data.summary.total }} {{ data.summary.total === 1 ? "review" : "reviews" }}</span
								>
							</div>
							<ul class="reviews-bars">
								<li
									v-for="row in data.summary.histogram"
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
						<div class="reviews-summary__write">
							<ReviewWriter :signed-in="data.signedIn" sign-in-href="/my-account?next=%2Freviews" />
						</div>
					</section>

					<nav v-if="data.sources.length > 1" aria-label="Platform">
						<ul class="reviews-filter">
							<li>
								<NuxtLink to="/reviews" :aria-current="data.source ? 'false' : 'true'">All</NuxtLink>
							</li>
							<li v-for="source in data.sources" :key="source">
								<NuxtLink
									:to="`/reviews?source=${source}`"
									:aria-current="data.source === source ? 'true' : 'false'"
									>{{ sourceLabel(source) }}</NuxtLink
								>
							</li>
						</ul>
					</nav>

					<p v-if="cards.length === 0" class="reviews-empty">
						{{
							data.source
								? `No ${sourceLabel(data.source)} reviews yet.`
								: "No reviews yet. Connect Google or Yelp in BusinessDash, or add reviews in the dashboard, and they'll appear here."
						}}
					</p>
					<template v-else>
						<ul class="review-wall">
							<li v-for="(card, i) in cards" :id="`review-${i}`" :key="card.review.id" class="review-card">
								<div class="review-card__head">
									<img v-if="card.avatar" class="review-card__avatar" :src="card.avatar" alt="" loading="lazy" />
									<span v-else class="review-card__avatar" aria-hidden="true">{{
										reviewerInitial(card.review)
									}}</span>
									<div>
										<p class="review-card__name">{{ reviewerName(card.review) }}</p>
										<p class="review-card__meta">
											<span class="review-stars" role="img" :aria-label="`${card.review.rating} out of 5`">{{
												reviewStars(card.review.rating)
											}}</span>
											· {{ formatReviewDate(card.review.timeCreated) }}
										</p>
									</div>
								</div>
								<p class="review-card__text">{{ card.review.text }}</p>
								<ul v-if="card.photos.length" class="review-card__photos" aria-label="Photos from the reviewer">
									<li v-for="photo in card.photos" :key="photo"><img :src="photo" alt="" loading="lazy" /></li>
								</ul>
								<p v-if="card.platform || card.review.verified" class="review-card__foot">
									<span v-if="card.platform" class="review-card__platform">{{ card.platform }}</span>
									<span v-if="card.review.verified" class="review-card__verified">✓ Verified</span>
									<a
										v-if="card.link && card.platform"
										class="review-card__link"
										:href="card.link"
										target="_blank"
										rel="noopener noreferrer"
										>Read on {{ card.platform }}</a
									>
								</p>
							</li>
						</ul>
						<p v-if="data.moreHref" class="reviews-more">
							<NuxtLink class="bd-btn bd-btn--ghost" :to="data.moreHref">Show more reviews</NuxtLink>
						</p>
					</template>
				</template>
			</section>
		</main>
		<BdFooter />
	</div>
</template>
