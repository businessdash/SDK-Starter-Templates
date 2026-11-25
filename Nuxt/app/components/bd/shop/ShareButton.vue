<!-- [bd-file:store] -->
<script setup lang="ts">
/** ↗ Share: the share sheet, or this page's link copied ("Link copied"). */
import { ref } from "vue";
import { shareLink } from "#shared/bd/shop";

const props = defineProps<{ title: string }>();
const route = useRoute();
const note = ref("");

async function share() {
	const url = `${window.location.origin}${route.path}`;
	const result = await shareLink(url, props.title);
	note.value = result === "copied" ? "Link copied" : result === "failed" ? "Couldn't share" : "";
	if (note.value) setTimeout(() => (note.value = ""), 2500);
}
</script>

<template>
	<button type="button" class="share" @click="share">
		<span aria-hidden="true">↗</span> Share
	</button>
	<span v-if="note" class="share__note" role="status">{{ note }}</span>
</template>
