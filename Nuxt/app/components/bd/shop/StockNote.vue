<!-- [bd-file:store] -->
<script setup lang="ts">
/** "Only 3 left", at five or fewer. */
defineProps<{ stock?: number | null }>();
</script>

<template>
	<p v-if="stock != null && stock > 0 && stock <= 5" class="product-detail__stock">
		Only {{ stock }} left
	</p>
</template>
