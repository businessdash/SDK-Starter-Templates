<script setup lang="ts">
import { BdSignIn } from "@businessdash/sdk/vue";
import { computed } from "vue";
import BdHeader from "~/components/bd/BdHeader.vue";
import BdFooter from "~/components/bd/BdFooter.vue";
import ReviewForm from "~/components/bd/ReviewForm.vue";
import { formatMoney } from "~/composables/useCart";
import type { PortalContext } from "../../server/api/bd/portal/context.get";

/**
 * Customer account page. Reads the validated session + work bundle from
 * `/api/bd/portal/context` (which checks the `bd_session` cookie
 * server-side). Signed out, it shows the business's own sign-in screen
 * (`<BdSignIn>`: name, logo and brand colours from BD; password, emailed
 * codes, and "Continue with Google / Apple / GitHub / Discord" — WorkOS
 * underneath, through the `/api/bd-auth/*` handler, which sets the cookie).
 */
const { data } = await useFetch<PortalContext>("/api/bd/portal/context");
const route = useRoute();
const start = computed(() =>
	route.query.start === "create" ? "createAccount" : "signIn",
);

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
		<BdHeader />
		<main>
			<section class="bd-section bd-section--narrow">
				<!-- Portal not configured: graceful no-op. -->
				<template v-if="!data?.configured">
					<div class="bd-section__lead">
						<span class="bd-section__eyebrow">Account</span>
						<h1 class="bd-section__title">My account</h1>
					</div>
					<div class="bd-empty">
						Customer accounts aren't connected yet. Set the BD env vars
						(<code>NUXT_BD_API_KEY</code>, <code>NUXT_BD_PACKAGE_API_BASE_URL</code>)
						to enable sign-in.
					</div>
				</template>

				<!-- Configured but signed out: the sign-in screen. -->
				<template v-else-if="!session">
					<div class="bd-card account-signin">
						<ClientOnly>
							<BdSignIn
								:start="start"
								redirect-to="/my-account"
								:brand="{
									tagline: 'Access your jobs, quotes, invoices, and leave a review.',
								}"
							/>
						</ClientOnly>
					</div>
				</template>

				<!-- Signed in: session summary + work bundle + review form. -->
				<template v-else>
					<div class="bd-section__lead">
						<span class="bd-section__eyebrow">Account</span>
						<h1 class="bd-section__title">Welcome, {{ displayName }}</h1>
					</div>

					<div class="bd-card account-summary">
						<div>
							<div class="bd-label">Signed in as</div>
							<div>{{ session.email }}</div>
						</div>
						<a class="bd-btn bd-btn--ghost" href="/api/bd-auth/sign-out">
							Sign out
						</a>
					</div>

					<div v-if="work?.unlinked" class="bd-empty">
						Your account isn't linked to a customer record yet. Once we connect
						it, your jobs and invoices will show here.
					</div>
					<div v-else-if="work" class="account-work">
						<div class="bd-card account-stat">
							<span class="account-stat__num">{{ work.summary.openJobCount }}</span>
							<span class="account-stat__label">Open jobs</span>
						</div>
						<div class="bd-card account-stat">
							<span class="account-stat__num">
								{{ work.summary.pendingQuoteCount }}
							</span>
							<span class="account-stat__label">Pending quotes</span>
						</div>
						<div class="bd-card account-stat">
							<span class="account-stat__num">
								{{ work.summary.unpaidInvoiceCount }}
							</span>
							<span class="account-stat__label">Unpaid invoices</span>
						</div>
						<div class="bd-card account-stat">
							<span class="account-stat__num">
								{{ formatMoney(work.summary.unpaidBalance) }}
							</span>
							<span class="account-stat__label">Balance due</span>
						</div>
					</div>

					<ReviewForm />

					<p class="account-delete">
						<a href="/api/bd-auth/delete-account">Delete my account</a>
					</p>
				</template>
			</section>
		</main>
		<BdFooter />
	</div>
</template>
