<!-- [bd-file:store] -->
<script setup lang="ts">
/** Details: the feature list, then a table per spec group. */
import type { SpecGroup } from "#shared/bd/shop";

defineProps<{ features: string[]; specs: SpecGroup[] }>();
</script>

<template>
	<section v-if="features.length > 0 || specs.length > 0" id="specs" class="product-section">
		<h2 class="product-section__title">Details</h2>
		<ul v-if="features.length > 0" class="features">
			<li v-for="feature in features" :key="feature">{{ feature }}</li>
		</ul>
		<table v-for="group in specs" :key="group.name" class="specs">
			<caption>{{ group.name }}</caption>
			<tbody>
				<tr v-for="row in group.rows" :key="row.label">
					<th scope="row">{{ row.label }}</th>
					<td>{{ row.value }}</td>
				</tr>
			</tbody>
		</table>
	</section>
</template>
