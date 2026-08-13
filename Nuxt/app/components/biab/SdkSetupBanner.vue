<script setup lang="ts">
/**
 * Dismissable "not connected to BIAB yet" banner. Every surface renders with
 * local fallbacks when the BIAB env is missing (so the template runs
 * unconfigured) — this just points you at the setup wizard. It disappears once
 * NUXT_PUBLIC_BIAB_SITE_ID + NUXT_PUBLIC_BIAB_PK are set (read here off
 * `runtimeConfig.public`), and can be dismissed for this browser meanwhile.
 */
import { onMounted, ref } from "vue";

const DISMISS_KEY = "biab-sdk-setup-banner-dismissed";

const config = useRuntimeConfig();
const siteId = config.public.biabSiteId as string | undefined;
const pk = config.public.biabPublicKey as string | undefined;
const baseUrl =
	(config.public.biabPackageApiBaseUrl as string | undefined) ||
	"https://www.biab.app";
const wizardUrl = `${baseUrl}/login?returnTo=/dashboard/settings/web-content`;

// Start hidden so SSR + first paint match; reveal on mount when unconfigured
// and not previously dismissed (localStorage is client-only).
const visible = ref(false);

onMounted(() => {
	if (siteId && pk) return; // configured — nothing to show
	if (localStorage.getItem(DISMISS_KEY) === "1") return;
	visible.value = true;
});

function dismiss() {
	localStorage.setItem(DISMISS_KEY, "1");
	visible.value = false;
}
</script>

<template>
	<div v-if="visible" class="biab-setup">
		<span class="biab-setup__text">
			<strong>Not connected to BIAB yet.</strong>
			Add your <code>.env</code> to render live content — grab every variable
			(site ID, keys, revalidation secret) from the guided wizard.
		</span>
		<a
			class="biab-setup__cta"
			:href="wizardUrl"
			rel="noreferrer"
			target="_blank"
		>
			Open setup wizard ↗
		</a>
		<button
			class="biab-setup__close"
			type="button"
			aria-label="Dismiss"
			@click="dismiss"
		>
			✕
		</button>
	</div>
</template>

<style scoped>
.biab-setup {
	position: fixed;
	inset-inline: 0;
	bottom: 0;
	z-index: 9999;
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 0.75rem;
	padding: 0.75rem 1rem;
	background: rgba(15, 23, 42, 0.96);
	color: #fff;
	border-top: 1px solid rgba(45, 212, 191, 0.35);
	backdrop-filter: blur(8px);
	font-size: 0.875rem;
}

.biab-setup__text {
	flex: 1 1 260px;
	min-width: 0;
}

.biab-setup__text strong {
	color: rgb(94, 234, 212);
}

.biab-setup__cta {
	flex-shrink: 0;
	border-radius: 0.5rem;
	border: 1px solid rgba(45, 212, 191, 0.5);
	background: rgba(45, 212, 191, 0.12);
	padding: 0.4rem 0.8rem;
	color: rgb(153, 246, 228);
	font-weight: 600;
	text-decoration: none;
}

.biab-setup__close {
	flex-shrink: 0;
	border: none;
	background: transparent;
	color: rgba(255, 255, 255, 0.6);
	cursor: pointer;
	font-size: 1.1rem;
	line-height: 1;
	padding: 0.25rem;
}
</style>
