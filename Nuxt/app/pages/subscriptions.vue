<script setup lang="ts">
import BdHeader from "~/components/bd/BdHeader.vue";
import BdFooter from "~/components/bd/BdFooter.vue";
import { formatMoney } from "~/composables/useCart";
import type { StoreSubscriptionsResult } from "../../server/api/bd/store/subscriptions.get";

/**
 * Subscriptions page. Lists the org's recurring-plan offerings from
 * `subscriptions.list()`. Display-only here; wiring a "subscribe" button
 * follows the same `checkout.forVisitor(...).start(...)` pattern as the
 * cart (see /api/bd/checkout/start).
 */
const { data } = await useFetch<StoreSubscriptionsResult>(
	"/api/bd/store/subscriptions",
);

function intervalLabel(interval: string): string {
	return `/ ${interval}`;
}

useHead({ title: "Subscriptions — Your Business" });
</script>

<template>
	<div>
		<BdHeader />
		<main>
			<section class="bd-section">
				<div class="bd-section__lead">
					<span class="bd-section__eyebrow">Plans</span>
					<h1 class="bd-section__title">Subscriptions</h1>
					<p class="bd-section__sub">
						Recurring plans from the BD subscriptions surface.
					</p>
				</div>

				<div v-if="data?.suspended" class="bd-empty">
					Subscriptions are temporarily unavailable. Please check back soon.
				</div>
				<div v-else-if="!data || data.items.length === 0" class="bd-empty">
					No subscription plans yet. Add some in BD at Dashboard → Products →
					Subscriptions.
				</div>
				<div v-else class="bd-grid-3">
					<article
						v-for="plan in data.items"
						:key="plan.id"
						class="bd-card plan-card"
					>
						<img
							v-if="plan.imageUrl"
							:alt="plan.name"
							class="plan-card__img"
							:src="plan.imageUrl"
						/>
						<h3>{{ plan.name }}</h3>
						<p v-if="plan.description">{{ plan.description }}</p>
						<div class="plan-card__price">
							{{ formatMoney(plan.amountCents) }}
							<span>{{ intervalLabel(plan.interval) }}</span>
						</div>
					</article>
				</div>

				<p class="store-links">
					<NuxtLink to="/store">← Back to store</NuxtLink>
				</p>
			</section>
		</main>
		<BdFooter />
	</div>
</template>
