<script setup lang="ts">
import { computed } from "vue";
import BiabHeader from "~/components/biab/BiabHeader.vue";
import BiabFooter from "~/components/biab/BiabFooter.vue";
import ReviewForm from "~/components/biab/ReviewForm.vue";
import { formatMoney } from "~/composables/useCart";
import type { PortalContext } from "../../server/api/biab/portal/context.get";

/**
 * Customer account page. Reads the validated session + work bundle from
 * `/api/biab/portal/context` (which checks the `biab_session` cookie
 * server-side). Sign-in / sign-up / sign-out are plain links to the
 * catch-all auth handler at `/api/biab-auth/*` — no client SDK needed.
 */
const { data } = await useFetch<PortalContext>("/api/biab/portal/context");

const session = computed(() => data.value?.session ?? null);
const work = computed(() => data.value?.work ?? null);
const displayName = computed(() => {
	const s = session.value;
	if (!s) return "";
	const name = [s.firstName, s.lastName].filter(Boolean).join(" ").trim();
	return name || s.email || "there";
});

useHead({ title: "My account — Your Business" });
</script>

<template>
	<div>
		<BiabHeader />
		<main>
			<section class="biab-section biab-section--narrow">
				<!-- Portal not configured: graceful no-op. -->
				<template v-if="!data?.configured">
					<div class="biab-section__lead">
						<span class="biab-section__eyebrow">Account</span>
						<h1 class="biab-section__title">My account</h1>
					</div>
					<div class="biab-empty">
						Customer accounts aren't connected yet. Set
						<code>NUXT_BIAB_AUTH_CALLBACK_URL</code> (and the other BIAB env
						vars) to enable sign-in.
					</div>
				</template>

				<!-- Configured but signed out: show auth links. -->
				<template v-else-if="!session">
					<div class="biab-section__lead">
						<span class="biab-section__eyebrow">Account</span>
						<h1 class="biab-section__title">Sign in</h1>
						<p class="biab-section__sub">
							Access your jobs, quotes, invoices, and leave a review.
						</p>
					</div>
					<div class="biab-card account-auth">
						<a class="biab-btn" href="/api/biab-auth/sign-in">Sign in</a>
						<a class="biab-btn biab-btn--ghost" href="/api/biab-auth/sign-up">
							Create account
						</a>
					</div>
				</template>

				<!-- Signed in: session summary + work bundle + review form. -->
				<template v-else>
					<div class="biab-section__lead">
						<span class="biab-section__eyebrow">Account</span>
						<h1 class="biab-section__title">Welcome, {{ displayName }}</h1>
					</div>

					<div class="biab-card account-summary">
						<div>
							<div class="biab-label">Signed in as</div>
							<div>{{ session.email }}</div>
						</div>
						<a class="biab-btn biab-btn--ghost" href="/api/biab-auth/sign-out">
							Sign out
						</a>
					</div>

					<div v-if="work?.unlinked" class="biab-empty">
						Your account isn't linked to a customer record yet. Once we connect
						it, your jobs and invoices will show here.
					</div>
					<div v-else-if="work" class="account-work">
						<div class="biab-card account-stat">
							<span class="account-stat__num">{{ work.summary.openJobCount }}</span>
							<span class="account-stat__label">Open jobs</span>
						</div>
						<div class="biab-card account-stat">
							<span class="account-stat__num">
								{{ work.summary.pendingQuoteCount }}
							</span>
							<span class="account-stat__label">Pending quotes</span>
						</div>
						<div class="biab-card account-stat">
							<span class="account-stat__num">
								{{ work.summary.unpaidInvoiceCount }}
							</span>
							<span class="account-stat__label">Unpaid invoices</span>
						</div>
						<div class="biab-card account-stat">
							<span class="account-stat__num">
								{{ formatMoney(work.summary.unpaidBalance) }}
							</span>
							<span class="account-stat__label">Balance due</span>
						</div>
					</div>

					<ReviewForm />
				</template>
			</section>
		</main>
		<BiabFooter />
	</div>
</template>
