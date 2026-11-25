<!-- [bd-file:store] -->
<script setup lang="ts">
/**
 * Pinned to the bottom of the store while products are picked for the
 * compare table: what's picked, and the way to the table.
 */
import { onBeforeUnmount, onMounted, ref } from "vue";
import { compareList, type SavedProduct } from "#shared/bd/shop";

const items = ref<SavedProduct[]>([]);
let off = () => {};
onMounted(() => {
	items.value = compareList.read();
	off = compareList.subscribe((next) => {
		items.value = next;
	});
});
onBeforeUnmount(() => off());
</script>

<template>
	<aside v-if="items.length > 0" class="compare-bar" aria-label="Products to compare">
		<ul class="compare-bar__items">
			<li v-for="item in items" :key="item.id">
				<img v-if="item.image" :src="item.image" alt="" referrerpolicy="no-referrer" />
				<span>{{ item.name }}</span>
				<button
					type="button"
					:aria-label="`Remove ${item.name} from compare`"
					@click="compareList.remove(item.id)"
				>
					×
				</button>
			</li>
		</ul>
		<div class="compare-bar__actions">
			<button type="button" class="bd-btn bd-btn--ghost" @click="compareList.clear()">
				Clear
			</button>
			<NuxtLink
				class="bd-btn"
				:to="`/store/compare?ids=${items.map((i) => i.id).join(',')}`"
				:aria-disabled="items.length < 2"
			>
				{{ items.length < 2 ? "Pick one more to compare" : `Compare ${items.length}` }}
			</NuxtLink>
		</div>
	</aside>
</template>
