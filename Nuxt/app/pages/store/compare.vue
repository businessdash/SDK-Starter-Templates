<!-- [bd-file:store] -->
<script setup lang="ts">
/**
 * Up to four products side by side: price, rating, category, options and
 * every spec any of them lists. The products are in the URL (?ids=a,b), so
 * a comparison can be shared; opened from the store links, the picks saved
 * in this browser are moved into the URL.
 */
import { computed, onMounted } from "vue";
import BdFooter from "~/components/bd/BdFooter.vue";
import BdHeader from "~/components/bd/BdHeader.vue";
import StoreNav from "~/components/bd/StoreNav.vue";
import { compareList, defaultVariant, formatDollars, toProductView } from "#shared/bd/shop";
import type { CompareColumn } from "../../../server/api/bd/store/compare.get";

const route = useRoute();
const router = useRouter();
const ids = computed(() =>
	(typeof route.query.ids === "string" ? route.query.ids : "")
		.split(",")
		.filter(Boolean)
		.slice(0, 4),
);
const { data } = await useFetch<{ columns: CompareColumn[] }>("/api/bd/store/compare", {
	query: computed(() => ({ ids: ids.value.join(",") })),
});
const columns = computed(() =>
	(data.value?.columns ?? []).map((column) => ({
		view: toProductView(column.product as Record<string, unknown>),
		rating: column.rating,
	})),
);

onMounted(() => {
	if (ids.value.length > 0) return;
	const saved = compareList.read().map((item) => item.id);
	if (saved.length > 0) router.replace({ query: { ids: saved.join(",") } });
});

function remove(id: string) {
	compareList.remove(id);
	const rest = ids.value.filter((other) => other !== id);
	router.replace({ query: rest.length ? { ids: rest.join(",") } : {} });
}

const specRows = computed(() => {
	const rows: { group: string; label: string }[] = [];
	const seen = new Set<string>();
	for (const { view } of columns.value) {
		for (const group of view.specs) {
			for (const row of group.rows) {
				const key = `${group.name}\u0000${row.label}`;
				if (!seen.has(key)) {
					seen.add(key);
					rows.push({ group: group.name, label: row.label });
				}
			}
		}
	}
	return rows;
});

function specValue(index: number, group: string, label: string): string {
	const view = columns.value[index]?.view;
	return view?.specs.find((g) => g.name === group)?.rows.find((r) => r.label === label)?.value ?? "—";
}

function startingPrice(index: number): string {
	const view = columns.value[index]?.view;
	const variant = view ? defaultVariant(view) : undefined;
	return variant?.price != null ? formatDollars(variant.price) : "—";
}

useHead({ title: "Compare products — Your Business" });
</script>

<template>
	<div>
		<BdHeader />
		<StoreNav />
		<main class="bd-section">
			<div class="bd-section__lead">
				<h1 class="bd-section__title">Compare products</h1>
				<p class="bd-section__sub">Up to four side by side.</p>
			</div>

			<div v-if="columns.length === 0" class="bd-empty">
				Nothing to compare yet. Press <span aria-hidden="true">⇄</span> Compare on two or more
				products.
				<p><NuxtLink class="bd-btn" to="/store">Browse products</NuxtLink></p>
			</div>
			<div v-else class="compare-scroll">
				<table class="compare">
					<caption class="visually-hidden">Products compared</caption>
					<thead>
						<tr>
							<td />
							<th v-for="{ view } in columns" :key="view.id" scope="col">
								<NuxtLink :to="`/store/${view.id}`" class="compare__product">
									<img
										v-if="view.images[0]"
										:src="view.images[0]"
										alt=""
										referrerpolicy="no-referrer"
									/>
									<span>{{ view.name }}</span>
								</NuxtLink>
								<button type="button" class="compare__remove" @click="remove(view.id)">
									Remove
								</button>
							</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<th scope="row">Price</th>
							<td v-for="(column, i) in columns" :key="column.view.id">{{ startingPrice(i) }}</td>
						</tr>
						<tr>
							<th scope="row">Rating</th>
							<td v-for="{ view, rating } in columns" :key="view.id">
								{{ rating ? `${rating.avg.toFixed(1)} ★ (${rating.count})` : "No reviews" }}
							</td>
						</tr>
						<tr>
							<th scope="row">Category</th>
							<td v-for="{ view } in columns" :key="view.id">{{ view.categoryName ?? "—" }}</td>
						</tr>
						<tr>
							<th scope="row">Options</th>
							<td v-for="{ view } in columns" :key="view.id">
								{{ view.variants.map((v) => v.name).join(", ") || "—" }}
							</td>
						</tr>
						<tr v-for="row in specRows" :key="row.group + row.label">
							<th scope="row">
								{{ row.label }} <small>{{ row.group }}</small>
							</th>
							<td v-for="(column, i) in columns" :key="column.view.id">
								{{ specValue(i, row.group, row.label) }}
							</td>
						</tr>
						<tr>
							<td />
							<td v-for="{ view } in columns" :key="view.id">
								<NuxtLink class="bd-btn" :to="`/store/${view.id}`">View product</NuxtLink>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</main>
		<BdFooter />
	</div>
</template>
