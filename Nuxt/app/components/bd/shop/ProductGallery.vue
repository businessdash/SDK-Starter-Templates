<!-- [bd-file:store] -->
<script setup lang="ts">
/**
 * The photos for what's chosen: the one shown (`v-model:photo`), ‹ and › to
 * step through them, and a thumbnail for each.
 */
const props = defineProps<{ photos: string[]; name: string }>();
const photo = defineModel<number>("photo", { default: 0 });

function step(by: number) {
	photo.value = (photo.value + by + props.photos.length) % props.photos.length;
}
</script>

<template>
	<div class="gallery">
		<div class="gallery__main">
			<img v-if="photos[photo]" :src="photos[photo]" :alt="name" referrerpolicy="no-referrer" />
			<div v-else class="gallery__placeholder">No photo yet</div>
			<template v-if="photos.length > 1">
				<button
					type="button"
					class="gallery__step gallery__step--prev"
					aria-label="Previous photo"
					@click="step(-1)"
				>
					‹
				</button>
				<button
					type="button"
					class="gallery__step gallery__step--next"
					aria-label="Next photo"
					@click="step(1)"
				>
					›
				</button>
			</template>
		</div>
		<div v-if="photos.length > 1" class="gallery__thumbs">
			<button
				v-for="(src, i) in photos"
				:key="src + i"
				type="button"
				class="gallery__thumb"
				:class="{ 'gallery__thumb--on': i === photo }"
				:aria-label="`Photo ${i + 1} of ${photos.length}`"
				:aria-current="i === photo"
				@click="photo = i"
			>
				<img :src="src" alt="" loading="lazy" referrerpolicy="no-referrer" />
			</button>
		</div>
	</div>
</template>
