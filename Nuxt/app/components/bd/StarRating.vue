<!-- [bd-file:store] -->
<script setup lang="ts">
/** Five stars, filled to `rating` (halves shown). */
defineProps<{ rating: number }>();
</script>

<template>
	<span class="stars" role="img" :aria-label="`${rating.toFixed(1)} out of 5`">
		<span
			v-for="i in 5"
			:key="i"
			class="stars__star"
			:class="{
				'stars__star--on': rating >= i,
				'stars__star--half': rating < i && rating >= i - 0.5,
			}"
			>★</span
		>
	</span>
</template>
