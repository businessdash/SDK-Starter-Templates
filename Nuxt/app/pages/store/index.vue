<!-- [bd-file:store] -->
<script setup lang="ts">
import { computed } from "vue";
import BdFooter from "~/components/bd/BdFooter.vue";
import BdHeader from "~/components/bd/BdHeader.vue";
import CompareBar from "~/components/bd/CompareBar.vue";
import SaveButtons from "~/components/bd/SaveButtons.vue";
import StarRating from "~/components/bd/StarRating.vue";
import StoreNav from "~/components/bd/StoreNav.vue";
import type { StoreProductsMetaResult } from "../../../server/api/bd/store/products-meta.get";

/**
 * The product list, with search, category, price and rating filters and a
 * sort. Every filter lives in the URL (?q, ?category, ?price=10-50,
 * ?rating, ?sort), so a filtered list can be shared or bookmarked, and the
 * list is fetched on the server through `/api/bd/store/products-meta`.
 */
const route = useRoute();
const router = useRouter();

const SORT_LABELS: Record<string, string> = {
	featured: "Featured",
	newest: "Newest",
	"price-asc": "Price: low to high",
	"price-desc": "Price: high to low",
	"rating-desc": "Top rated",
};

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

const countByCategory = computed(
	() => new Map((data.value?.categoryCounts ?? []).map((c) => [c.categoryId, c.count])),
);
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

function onSearch(event: Event) {
	const form = new FormData(event.target as HTMLFormElement);
	setParam("q", String(form.get("q") ?? "").trim() || null);
}

function onPrice(event: Event) {
	const form = new FormData(event.target as HTMLFormElement);
	const min = String(form.get("min") ?? "").trim();
	const max = String(form.get("max") ?? "").trim();
	setParam("price", min || max ? `${min}-${max}` : null);
}

function priceLabel(cents: number | null): string {
	if (cents == null) return "—";
	const dollars = cents / 100;
	return `$${dollars.toLocaleString(undefined, {
		minimumFractionDigits: dollars % 1 === 0 ? 0 : 2,
		maximumFractionDigits: 2,
	})}`;
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
					<form @submit.prevent="onSearch">
						<label class="bd-label" for="store-search">Search</label>
						<input
							id="store-search"
							class="bd-input"
							type="search"
							name="q"
							placeholder="Search products…"
							:value="filters.search"
							autocomplete="off"
						/>
					</form>

					<div v-if="data?.categories.length" class="store-facet">
						<p class="store-facet__title">Category</p>
						<ul class="store-facet__list">
							<li>
								<button
									type="button"
									class="store-facet__item"
									:class="{ 'store-facet__item--active': !filters.categoryId }"
									@click="setParam('category', null)"
								>
									All products
								</button>
							</li>
							<li v-for="c in data.categories" :key="c.id">
								<button
									type="button"
									class="store-facet__item store-facet__item--row"
									:class="{ 'store-facet__item--active': filters.categoryId === c.id }"
									@click="setParam('category', filters.categoryId === c.id ? null : c.id)"
								>
									<span>{{ c.name }}</span>
									<span class="store-facet__count">{{ countByCategory.get(c.id) ?? 0 }}</span>
								</button>
							</li>
						</ul>
					</div>

					<form class="store-facet" @submit.prevent="onPrice">
						<p class="store-facet__title">Price</p>
						<div class="store-price">
							<input
								class="bd-input"
								inputmode="numeric"
								name="min"
								aria-label="Lowest price"
								:placeholder="`$${data?.priceRange.minDollars ?? 0}`"
								:value="filters.minDollars ?? ''"
							/>
							<span class="store-price__sep">–</span>
							<input
								class="bd-input"
								inputmode="numeric"
								name="max"
								aria-label="Highest price"
								:placeholder="`$${data?.priceRange.maxDollars ?? 0}`"
								:value="filters.maxDollars ?? ''"
							/>
						</div>
						<button type="submit" class="bd-btn bd-btn--ghost store-price__apply">
							Apply
						</button>
					</form>

					<div class="store-facet">
						<p class="store-facet__title">Rating</p>
						<ul class="store-facet__list">
							<li v-for="r in [4, 3, 2]" :key="r">
								<button
									type="button"
									class="store-facet__item store-facet__rating"
									:class="{ 'store-facet__item--active': filters.minRating === r }"
									@click="setParam('rating', filters.minRating === r ? null : String(r))"
								>
									<StarRating :rating="r" />
									<span class="store-facet__count">&amp; up</span>
								</button>
							</li>
						</ul>
					</div>

					<button
						v-if="hasFilters"
						type="button"
						class="store-clear"
						@click="router.push('/store')"
					>
						Clear all filters
					</button>
				</aside>

				<div class="store-results">
					<div class="store-results__bar">
						<p class="bd-loading">
							{{ data?.items.length ?? 0 }}
							{{ data?.items.length === 1 ? "product" : "products" }}
						</p>
						<label class="store-sort">
							<span>Sort</span>
							<select
								class="bd-select"
								:value="filters.sort"
								@change="
									setParam(
										'sort',
										($event.target as HTMLSelectElement).value === 'featured'
											? null
											: ($event.target as HTMLSelectElement).value,
									)
								"
							>
								<option v-for="(label, value) in SORT_LABELS" :key="value" :value="value">
									{{ label }}
								</option>
							</select>
						</label>
					</div>

					<div v-if="!data?.items.length" class="bd-empty">
						{{
							hasFilters
								? "No products match these filters. Try clearing a filter or broadening your search."
								: "No live products yet. Add and publish products in the BD dashboard and they'll appear here."
						}}
					</div>
					<div v-else class="bd-grid-3">
						<div v-for="product in data.items" :key="product.id" class="bd-card product-card">
							<NuxtLink class="product-card__link" :to="`/store/${product.id}`">
								<div class="product-card__media">
									<img
										v-if="product.coverImage"
										class="product-card__img"
										:src="product.coverImage"
										:alt="product.name"
										loading="lazy"
										referrerpolicy="no-referrer"
									/>
									<div v-else class="product-card__noimg">No image</div>
									<div class="product-card__badges">
										<span v-if="product.isBestSeller" class="bd-badge">Best seller</span>
										<span v-if="product.isNew" class="bd-badge">New</span>
										<span v-if="product.isOnSale" class="bd-badge product-card__badge--sale">
											Sale
										</span>
									</div>
								</div>
								<div class="product-card__body">
									<h3>{{ product.name || "Untitled" }}</h3>
									<div v-if="product.reviewCount > 0" class="product-card__rating">
										<StarRating :rating="product.avgRating" />
										<span class="product-card__count">({{ product.reviewCount }})</span>
									</div>
									<div class="product-card__price">
										<span class="product-card__amount">
											{{ product.hasMultipleVariants ? "From " : ""
											}}{{ priceLabel(product.cheapestPriceCents) }}
										</span>
										<span
											v-if="product.isOnSale && product.comparePriceCents != null"
											class="product-card__compare"
										>
											{{ priceLabel(product.comparePriceCents) }}
										</span>
									</div>
									<span v-if="product.isLowStock" class="product-card__lowstock">
										Low stock
									</span>
								</div>
							</NuxtLink>
							<div class="product-card__save">
								<SaveButtons
									compact
									:product="{
										id: product.id,
										name: product.name,
										image: product.coverImage,
										priceCents: product.cheapestPriceCents,
									}"
								/>
							</div>
						</div>
					</div>
					<CompareBar />
				</div>
			</div>
		</main>
		<BdFooter />
	</div>
</template>
