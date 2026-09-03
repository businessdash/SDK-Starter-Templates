<script setup lang="ts">
import type { GalleryItem } from "../../../server/api/bd/home.get";

defineProps<{ items: GalleryItem[] }>();
</script>

<template>
	<section class="bd-section" id="gallery">
		<div class="bd-section__lead">
			<span class="bd-section__eyebrow">Recent work</span>
			<h2 class="bd-section__title">Gallery</h2>
			<p class="bd-section__sub">
				Pulled live from the BD gallery surface. Each tile only fetches the
				fields it actually displays.
			</p>
		</div>
		<div v-if="items.length === 0" class="bd-empty">
			No gallery items yet. Add a few in BD and they'll appear here.
		</div>
		<div v-else class="bd-grid-4">
			<div
				v-for="item in items"
				:key="item.id"
				class="bd-card gallery-tile"
			>
				<img
					v-if="item.src"
					:alt="item.title ?? item.category ?? 'Gallery item'"
					loading="lazy"
					:src="item.src"
					:style="
						item.blurDataURL
							? `background-image: url(${item.blurDataURL}); background-size: cover;`
							: undefined
					"
				/>
				<div
					v-if="item.title || item.category"
					class="gallery-tile__caption"
				>
					{{ item.title ?? item.category }}
				</div>
			</div>
		</div>
	</section>
</template>
