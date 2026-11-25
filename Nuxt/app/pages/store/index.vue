<!-- [bd-file:store] -->
<script setup lang="ts">
import { computed } from "vue";
import BdFooter from "~/components/bd/BdFooter.vue";
import BdHeader from "~/components/bd/BdHeader.vue";
import CompareBar from "~/components/bd/CompareBar.vue";
import CategoryFilter from "~/components/bd/shop/CategoryFilter.vue";
import ClearFilters from "~/components/bd/shop/ClearFilters.vue";
import PriceFilter from "~/components/bd/shop/PriceFilter.vue";
import ProductGrid from "~/components/bd/shop/ProductGrid.vue";
import RatingFilter from "~/components/bd/shop/RatingFilter.vue";
import SortSelect, { SORT_LABELS } from "~/components/bd/shop/SortSelect.vue";
import StoreSearch from "~/components/bd/shop/StoreSearch.vue";
import StoreNav from "~/components/bd/StoreNav.vue";
import type { StoreProductsMetaResult } from "../../../server/api/bd/store/products-meta.get";

/**
 * The product list, with search, category, price and rating filters and a
 * sort. Every filter lives in the URL (?q, ?category, ?price=10-50,
 * ?rating, ?sort), so a filtered list can be shared or bookmarked, and the
 * list is fetched on the server through `/api/bd/store/products-meta`. The
 * page is laid out from the shop's parts in `components/bd/shop/`: the
 * filters, and a product card per product.
 */
const route = useRoute();
const router = useRouter();

const param = (key: string) =>
	typeof route.query[key] === "string" ? (route.query[key] as string) : "";

const filters = computed(() => {
	const [min, max] = param("price")
		.split("-")
		.map((n) => Number.parseInt(n, 10));
	const rating = Number.parseInt(param("rating"), 10);
	return {
		search: param("q").trim(),
		categoryId: param("category"),
		sort: param("sort") in SORT_LABELS ? param("sort") : "featured",
		minRating: rating >= 1 && rating <= 5 ? rating : null,
		minDollars: Number.isFinite(min) ? (min as number) : null,
		maxDollars: Number.isFinite(max) ? (max as number) : null,
	};
});

const { data } = await useFetch<StoreProductsMetaResult>(
	"/api/bd/store/products-meta",
	{
		query: computed(() => ({
			limit: 50,
			...(filters.value.search ? { search: filters.value.search } : {}),
			...(filters.value.categoryId ? { categoryId: filters.value.categoryId } : {}),
			...(filters.value.minRating ? { minRating: filters.value.minRating } : {}),
			...(filters.value.minDollars != null
				? { minPriceCents: filters.value.minDollars * 100 }
				: {}),
			...(filters.value.maxDollars != null
				? { maxPriceCents: filters.value.maxDollars * 100 }
				: {}),
			sort: filters.value.sort,
		})),
	},
);

// Each category with its live product count, for the sidebar.
const categories = computed(() => {
	const counts = new Map((data.value?.categoryCounts ?? []).map((c) => [c.categoryId, c.count]));
	return (data.value?.categories ?? []).map((c) => ({
		id: c.id,
		name: c.name,
		count: counts.get(c.id) ?? 0,
	}));
});
const hasFilters = computed(() =>
	Boolean(
		filters.value.search ||
			filters.value.categoryId ||
			filters.value.minRating ||
			filters.value.minDollars != null ||
			filters.value.maxDollars != null,
	),
);

function setParam(key: string, value: string | null) {
	const query = { ...route.query };
	if (value === null || value === "") delete query[key];
	else query[key] = value;
	router.push({ path: "/store", query });
}

useHead({ title: "Store — Your Business" });
</script>

<template>
	<div>
		<BdHeader />
		<StoreNav />
		<main class="bd-section">
			<div class="bd-section__lead">
				<span class="bd-section__eyebrow">Shop</span>
				<h1 class="bd-section__title">Products</h1>
				<p class="bd-section__sub">
					Filter, sort, and open a product to choose its options and add it to your
					cart.
				</p>
			</div>

			<div v-if="data?.suspended" class="bd-empty">
				The store is temporarily unavailable. Please check back soon.
			</div>
			<div v-else class="store-layout">
				<aside class="store-sidebar">
					<StoreSearch :value="filters.search" @search="(q) => setParam('q', q || null)" />
					<CategoryFilter
						:categories="categories"
						:selected="filters.categoryId || null"
						@select="(id) => setParam('category', id)"
					/>
					<PriceFilter
						:min="filters.minDollars"
						:max="filters.maxDollars"
						:range="data?.priceRange"
						@apply="(min, max) => setParam('price', min || max ? `${min}-${max}` : null)"
					/>
					<RatingFilter
						:selected="filters.minRating"
						@select="(r) => setParam('rating', r === null ? null : String(r))"
					/>
					<ClearFilters v-if="hasFilters" @clear="router.push('/store')" />
				</aside>

				<div class="store-results">
					<div class="store-results__bar">
						<p class="bd-loading">
							{{ data?.items.length ?? 0 }}
							{{ data?.items.length === 1 ? "product" : "products" }}
						</p>
						<SortSelect
							:value="filters.sort"
							@sort="(sort) => setParam('sort', sort === 'featured' ? null : sort)"
						/>
					</div>

					<div v-if="!data?.items.length" class="bd-empty">
						{{
							hasFilters
								? "No products match these filters. Try clearing a filter or broadening your search."
								: "No live products yet. Add and publish products in the BD dashboard and they'll appear here."
						}}
					</div>
					<ProductGrid v-else :products="data.items" />
					<CompareBar />
				</div>
			</div>
		</main>
		<BdFooter />
	</div>
</template>
