<script setup lang="ts">
import { ref } from "vue";
import type { BannerMessage } from "../../../server/api/bd/home.get";

/**
 * Dismissible news bar driven by `bundle.banner`. Shows the first
 * active message; dismissing it hides the bar for the session. The
 * banner is schedule-aware on the server — by the time messages reach
 * here they're already filtered to the active set.
 */
const props = defineProps<{ messages: BannerMessage[] }>();

const dismissed = ref(false);
const message = props.messages[0] ?? null;
</script>

<template>
	<div
		v-if="message && !dismissed"
		class="news-banner"
		:class="{ 'news-banner--urgent': message.urgent }"
		role="region"
		aria-label="Announcement"
	>
		<span class="news-banner__text">{{ message.text }}</span>
		<a
			v-if="message.linkUrl"
			class="news-banner__link"
			:href="message.linkUrl"
			:rel="message.openInNewTab ? 'noopener' : undefined"
			:target="message.openInNewTab ? '_blank' : undefined"
		>
			{{ message.buttonText || "Learn more" }}
		</a>
		<button
			aria-label="Dismiss announcement"
			class="news-banner__close"
			type="button"
			@click="dismissed = true"
		>
			×
		</button>
	</div>
</template>
