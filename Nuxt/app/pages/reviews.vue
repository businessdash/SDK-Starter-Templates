<script setup lang="ts">
import { ref } from "vue";
import BdHeader from "~/components/bd/BdHeader.vue";
import BdFooter from "~/components/bd/BdFooter.vue";
import type { ReviewWallItem } from "@businessdash/sdk/contracts";
import type { ReviewsPageResult } from "../../server/api/bd/reviews.get";

/**
 * Reviews wall. Server-renders the first page (aggregate `totalCount` +
 * items) via `/api/bd/reviews`, then "Load more" pages forward with
 * the returned `nextOffset`. The SDK's `reviews.list` runs server-side.
 */
const PAGE_SIZE = 10;

const { data } = await useFetch<ReviewsPageResult>("/api/bd/reviews", {
	query: { limit: PAGE_SIZE, offset: 0 },
});

const items = ref<ReviewWallItem[]>(data.value?.items ?? []);
const totalCount = ref(data.value?.totalCount ?? 0);
const nextOffset = ref<number | null>(data.value?.nextOffset ?? null);
const loading = ref(false);

async function loadMore() {
	if (nextOffset.value == null) return;
	loading.value = true;
	try {
		const res = await $fetch<ReviewsPageResult>("/api/bd/reviews", {
			query: { limit: PAGE_SIZE, offset: nextOffset.value },
		});
		items.value = [...items.value, ...res.items];
		nextOffset.value = res.nextOffset;
		totalCount.value = res.totalCount;
	} finally {
		loading.value = false;
	}
}

function formatDate(iso: string): string {
	const d = new Date(iso);
	return Number.isNaN(d.getTime())
		? ""
		: d.toLocaleDateString(undefined, {
				year: "numeric",
				month: "short",
				day: "numeric",
			});
}

useHead({ title: "Reviews — Your Business" });
</script>

<template>
	<div>
		<BdHeader />
		<main>
			<section class="bd-section bd-section--narrow">
				<div class="bd-section__lead">
					<span class="bd-section__eyebrow">Testimonials</span>
					<h1 class="bd-section__title">Reviews</h1>
					<p v-if="totalCount > 0" class="bd-section__sub">
						{{ totalCount }} review{{ totalCount === 1 ? "" : "s" }} from real
						customers.
					</p>
				</div>

				<div v-if="items.length === 0" class="bd-empty">
					No reviews yet. Once your customers leave reviews, they'll appear here.
				</div>
				<div v-else class="reviews-wall">
					<article
						v-for="review in items"
						:key="review.id"
						class="bd-card review-card"
					>
						<div class="review-card__head">
							<span class="review-card__stars" aria-hidden="true">
								{{ "★".repeat(Math.round(review.rating)) }}
							</span>
							<span class="review-card__name">{{ review.reviewerName }}</span>
						</div>
						<p class="review-card__text">{{ review.text }}</p>
						<div class="review-card__meta">
							{{ formatDate(review.timeCreated) }}
							<span v-if="review.verified" class="bd-badge">Verified</span>
						</div>
					</article>
				</div>

				<div v-if="nextOffset != null" class="reviews-wall__more">
					<button
						class="bd-btn bd-btn--ghost"
						:disabled="loading"
						type="button"
						@click="loadMore"
					>
						{{ loading ? "Loading…" : "Load more" }}
					</button>
				</div>
			</section>
		</main>
		<BdFooter />
	</div>
</template>
