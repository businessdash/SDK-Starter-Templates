<!-- [bd-file:store] -->
<script setup lang="ts">
/** The search box; `search` fires with what was typed (trimmed) when it's sent. */
withDefaults(defineProps<{ value?: string }>(), { value: "" });
const emit = defineEmits<{ search: [q: string] }>();

function submit(event: Event) {
	const form = new FormData(event.target as HTMLFormElement);
	emit("search", String(form.get("q") ?? "").trim());
}
</script>

<template>
	<form @submit.prevent="submit">
		<label class="bd-label" for="store-search">Search</label>
		<input
			id="store-search"
			class="bd-input"
			type="search"
			name="q"
			placeholder="Search products…"
			:value="value"
			autocomplete="off"
		/>
	</form>
</template>
