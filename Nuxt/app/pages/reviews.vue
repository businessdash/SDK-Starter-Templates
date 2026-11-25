<script setup lang="ts">
import { computed } from "vue";
import BdHeader from "~/components/bd/BdHeader.vue";
import BdFooter from "~/components/bd/BdFooter.vue";
import ReviewWriter from "~/components/bd/ReviewWriter.vue";
import RatingSummary from "~/components/bd/reviews/RatingSummary.vue";
import ReviewCard from "~/components/bd/reviews/ReviewCard.vue";
import ReviewFilter from "~/components/bd/reviews/ReviewFilter.vue";
import { sourceLabel } from "#shared/bd/reviews";
import type { ReviewsPageData } from "../../server/api/bd/reviews/page.get";

/**
 * The business's reviews, laid out from the parts in
 * `components/bd/reviews/`: the rating with a bar per star, a platform
 * filter (`?source=`), a review card per review, "Show more" (`?shown=`),
 * and writing one (ReviewWriter). The page's data is `/api/bd/reviews/page`.
 */
const route = useRoute();
const query = computed(() => ({ source: route.query.source, shown: route.query.shown }));
const { data } = await useFetch<ReviewsPageData>("/api/bd/reviews/page", { query });

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
					<RatingSummary :summary="data.summary">
						<ReviewWriter :signed-in="data.signedIn" sign-in-href="/my-account?next=%2Freviews" />
					</RatingSummary>
					<ReviewFilter :sources="data.sources" :selected="data.source" />

					<p v-if="data.reviews.length === 0" class="reviews-empty">
						{{
							data.source
								? `No ${sourceLabel(data.source)} reviews yet.`
								: "No reviews yet. Connect Google or Yelp in BusinessDash, or add reviews in the dashboard, and they'll appear here."
						}}
					</p>
					<template v-else>
						<ul class="review-wall">
							<ReviewCard
								v-for="(review, i) in data.reviews"
								:id="`review-${i}`"
								:key="review.id"
								:review="review"
							/>
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
