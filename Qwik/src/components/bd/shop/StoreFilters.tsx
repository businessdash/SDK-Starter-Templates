// [bd-file:store]
import { $, component$, useSignal } from "@builder.io/qwik";
import { useLocation, useNavigate } from "@builder.io/qwik-city";

import type { StorefrontCategory, StorefrontSort } from "@businessdash/sdk/contracts";

import { ShopStars } from "../ShopStars";

/**
 * The store's filters, one part each: search, category, price, rating,
 * Clear all filters, and sort. They live in the URL (`q`, `category`,
 * `price` as `min-max`, `rating`, `sort`), so a filtered list can be shared;
 * each part reads the URL and changes it, and the route's loader reads the
 * products for it.
 */

export const SORT_VALUES: readonly StorefrontSort[] = ["featured", "newest", "price-asc", "price-desc", "rating-desc"];

export const SORT_LABELS: Record<StorefrontSort, string> = {
	featured: "Featured",
	newest: "Newest",
	"price-asc": "Price: low to high",
	"price-desc": "Price: high to low",
	"rating-desc": "Top rated",
};

/** The filters in the URL. */
export function useStoreFilters() {
	const params = useLocation().url.searchParams;
	const search = params.get("q") ?? "";
	const category = params.get("category") ?? "";
	const rating = Number(params.get("rating") ?? "0");
	const sort = (params.get("sort") as StorefrontSort | null) ?? "featured";
	const price = params.get("price") ?? "";
	const [min = "", max = ""] = price.split("-");
	return { search, category, rating, sort, price, min, max, active: Boolean(search || category || rating || price) };
}

/** Sets one filter in the URL (dropped when empty) and opens it. */
export function useSetFilter(storeHref = "/store") {
	const loc = useLocation();
	const nav = useNavigate();
	return $(async (key: string, value: string | null) => {
		const params = new URLSearchParams(loc.url.searchParams);
		if (value === null || value === "") params.delete(key);
		else params.set(key, value);
		const qs = params.toString();
		await nav(qs ? `${storeHref}?${qs}` : storeHref);
	});
}

/** The search box. */
export const StoreSearch = component$(() => {
	const { search } = useStoreFilters();
	const setFilter = useSetFilter();
	return (
		<form
			preventdefault:submit
			role="search"
			onSubmit$={(e) => {
				const fd = new FormData(e.target as HTMLFormElement);
				const q = String(fd.get("q") ?? "").trim();
				setFilter("q", q || null);
			}}
		>
			<label class="bd-label" for="store-search">
				Search
			</label>
			<input
				autoComplete="off"
				class="bd-input"
				id="store-search"
				name="q"
				placeholder="Search products…"
				type="search"
				value={search}
			/>
		</form>
	);
});

/** All products, then each category with how many products it has. */
export const CategoryFilter = component$<{
	categories: StorefrontCategory[];
	counts: { categoryId: string; count: number }[];
}>(({ categories, counts }) => {
	const { category: activeCategory } = useStoreFilters();
	const setFilter = useSetFilter();
	if (categories.length === 0) return null;
	const countByCategory = new Map(counts.map((c) => [c.categoryId, c.count]));
	return (
		<div class="store-facet">
			<p class="store-facet__title">Category</p>
			<ul class="store-facet__list">
				<li>
					<button
						aria-pressed={!activeCategory}
						class={`store-facet__item${activeCategory ? "" : " store-facet__item--active"}`}
						onClick$={() => setFilter("category", null)}
						type="button"
					>
						All products
					</button>
				</li>
				{categories.map((c) => {
					const active = activeCategory === c.id;
					return (
						<li key={c.id}>
							<button
								aria-pressed={active}
								class={`store-facet__item store-facet__item--row${active ? " store-facet__item--active" : ""}`}
								onClick$={() => setFilter("category", active ? null : c.id)}
								type="button"
							>
								<span>{c.name}</span>
								<span class="store-facet__count">{countByCategory.get(c.id) ?? 0}</span>
							</button>
						</li>
					);
				})}
			</ul>
		</div>
	);
});

/** Lowest and highest price, with Apply. `range` is what the store's products cost. */
export const PriceFilter = component$<{ range: { minDollars: number; maxDollars: number } }>(({ range }) => {
	const { min, max } = useStoreFilters();
	const setFilter = useSetFilter();
	const minPrice = useSignal(min);
	const maxPrice = useSignal(max);
	return (
		<form
			class="store-facet"
			preventdefault:submit
			onSubmit$={() => {
				const low = minPrice.value.trim();
				const high = maxPrice.value.trim();
				setFilter("price", low || high ? `${low}-${high}` : null);
			}}
		>
			<p class="store-facet__title">Price</p>
			<div class="store-price">
				<input
					aria-label="Lowest price"
					bind:value={minPrice}
					class="bd-input"
					inputMode="decimal"
					placeholder={`$${Math.floor(range.minDollars)}`}
				/>
				<span aria-hidden="true" class="store-price__sep">
					–
				</span>
				<input
					aria-label="Highest price"
					bind:value={maxPrice}
					class="bd-input"
					inputMode="decimal"
					placeholder={`$${Math.ceil(range.maxDollars)}`}
				/>
			</div>
			<button class="bd-btn bd-btn--ghost store-price__apply" type="submit">
				Apply
			</button>
		</form>
	);
});

/** 4, 3 or 2 stars & up. */
export const RatingFilter = component$(() => {
	const { rating: activeRating } = useStoreFilters();
	const setFilter = useSetFilter();
	return (
		<div class="store-facet">
			<p class="store-facet__title">Rating</p>
			<ul class="store-facet__list">
				{[4, 3, 2].map((r) => {
					const active = activeRating === r;
					return (
						<li key={r}>
							<button
								aria-pressed={active}
								class={`store-facet__item store-facet__rating${active ? " store-facet__item--active" : ""}`}
								onClick$={() => setFilter("rating", active ? null : String(r))}
								type="button"
							>
								<ShopStars rating={r} />
								<span class="store-facet__count">&amp; up</span>
							</button>
						</li>
					);
				})}
			</ul>
		</div>
	);
});

/** Clear all filters, while any is set. */
export const ClearFilters = component$<{ storeHref?: string }>(({ storeHref = "/store" }) => {
	const { active } = useStoreFilters();
	const nav = useNavigate();
	if (!active) return null;
	return (
		<button class="store-clear" onClick$={() => nav(storeHref)} type="button">
			Clear all filters
		</button>
	);
});

/** Featured, Newest, Price either way, Top rated. */
export const SortSelect = component$(() => {
	const { sort } = useStoreFilters();
	const setFilter = useSetFilter();
	return (
		<div class="store-sort">
			<label for="store-sort">Sort</label>
			<select
				class="bd-select"
				id="store-sort"
				onChange$={(e) => {
					const value = (e.target as HTMLSelectElement).value;
					setFilter("sort", value === "featured" ? null : value);
				}}
				value={sort}
			>
				{SORT_VALUES.map((s) => (
					<option key={s} value={s}>
						{SORT_LABELS[s]}
					</option>
				))}
			</select>
		</div>
	);
});
