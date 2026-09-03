<template>
	<div>
		<NuxtRouteAnnouncer />
		<NuxtPage />
		<SdkSetupBanner />
	</div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount } from "vue";
import { initBdAnalytics } from "@businessdash/sdk/analytics-core";
import SdkSetupBanner from "~/components/bd/SdkSetupBanner.vue";

const config = useRuntimeConfig();
let tracker: ReturnType<typeof initBdAnalytics> | null = null;

onMounted(() => {
	const siteId = config.public.bdSiteId as string | undefined;
	const baseUrl = config.public.bdPackageApiBaseUrl as string | undefined;
	const apiKey = config.public.bdPublicKey as string | undefined;
	if (!siteId || !baseUrl || !apiKey) return;
	tracker = initBdAnalytics({ siteId, baseUrl, apiKey });
});

onBeforeUnmount(() => {
	tracker?.stop();
});
</script>
