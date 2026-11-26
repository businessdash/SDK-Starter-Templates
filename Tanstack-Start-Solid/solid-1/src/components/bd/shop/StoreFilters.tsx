// [bd-file:store]
import type { StorefrontSort } from "@businessdash/sdk/contracts";
import { getRouteApi, useNavigate } from "@tanstack/solid-router";
import { For, Show } from "solid-js";

import { ShopStars } from "../ShopStars";

/**
 * The store's filters and sort. Every filter is in the URL (?q, ?category,
 * ?min, ?max, ?rating, ?sort), so a filtered list can be shared; each part
 * reads the store route's search and navigates to the list with its change.
 */

export type StoreSearch = {
	q?: string;
	category?: string;
	min?: number;
	max?: number;
	rating?: number;
	sort?: StorefrontSort;
};

export const SORT_LABELS: Record<StorefrontSort, string> = {
	featured: "Featured",
	newest: "Newest",
	"price-asc": "Price: low to high",
	"price-desc": "Price: high to low",
	"rating-desc": "Top rated",
};

export function text(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function positive(value: unknown): number | undefined {
	const n = typeof value === "number" ? value : Number(value);
	return Number.isFinite(n) && n > 0 ? n : undefined;
}

const store = getRouteApi("/store/");

/** The store's search, and the list with some filters changed (undefined drops one). */
function useStoreFilters() {
	const search = store.useSearch();
	const navigate = useNavigate();
	const setFilters = (next: Partial<StoreSearch>) =>
		navigate({ to: "/store", search: { ...search(), ...next } });
	return { search, setFilters, navigate };
}

/** Whether any filter is on (the sort doesn't count). */
export function hasFilters(s: StoreSearch): boolean {
	return Boolean(
		s.q || s.category || s.rating || s.min != null || s.max != null,
	);
}

/** Search products (?q). */
export function StoreSearch() {
	const { search, setFilters } = useStoreFilters();
	const onSearch = (e: SubmitEvent) => {
		e.preventDefault();
		const q = String(
			new FormData(e.currentTarget as HTMLFormElement).get("q") ?? "",
		);
		setFilters({ q: text(q) });
	};
	return (
		<search>
			<form onSubmit={onSearch}>
				<label class="bd-label" for="store-search">
					Search
				</label>
				<input
					autocomplete="off"
					class="bd-input"
					id="store-search"
					name="q"
					placeholder="Search products…"
					type="search"
					value={search().q ?? ""}
				/>
			</form>
		</search>
	);
}

/** All products, then a button per category with how many products it has. */
export function CategoryFilter(props: {
	categories: Array<{ id: string; name: string }>;
	counts: Array<{ categoryId: string; count: number }>;
}) {
	const { search, setFilters } = useStoreFilters();
	const countFor = (id: string) =>
		props.counts.find((c) => c.categoryId === id)?.count ?? 0;
	return (
		<Show when={props.categories.length > 0}>
			<div class="store-facet">
				<p class="store-facet__title">Category</p>
				<ul class="store-facet__list">
					<li>
						<button
							aria-pressed={search().category ? "false" : "true"}
							class={`store-facet__item${search().category ? "" : " store-facet__item--active"}`}
							onClick={() => setFilters({ category: undefined })}
							type="button"
						>
							All products
						</button>
					</li>
					<For each={props.categories}>
						{(c) => {
							const active = () => search().category === c.id;
							return (
								<li>
									<button
										aria-pressed={active() ? "true" : "false"}
										class={`store-facet__item store-facet__item--row${active() ? " store-facet__item--active" : ""}`}
										onClick={() =>
											setFilters({ category: active() ? undefined : c.id })
										}
										type="button"
									>
										<span>{c.name}</span>
										<span class="store-facet__count">{countFor(c.id)}</span>
									</button>
								</li>
							);
						}}
					</For>
				</ul>
			</div>
		</Show>
	);
}

/** Lowest and highest price (?min, ?max, in dollars), with Apply. */
export function PriceFilter(props: {
	/** The store's cheapest and dearest, shown as placeholders. */
	range: { minDollars: number; maxDollars: number };
}) {
	const { search, setFilters } = useStoreFilters();
	const onPrice = (e: SubmitEvent) => {
		e.preventDefault();
		const fd = new FormData(e.currentTarget as HTMLFormElement);
		setFilters({ min: positive(fd.get("min")), max: positive(fd.get("max")) });
	};
	return (
		<form class="store-facet" onSubmit={onPrice}>
			<p class="store-facet__title">Price</p>
			<div class="store-price">
				<input
					aria-label="Lowest price"
					class="bd-input"
					inputmode="decimal"
					name="min"
					placeholder={`$${Math.floor(props.range.minDollars)}`}
					value={search().min ?? ""}
				/>
				<span aria-hidden="true" class="store-price__sep">
					–
				</span>
				<input
					aria-label="Highest price"
					class="bd-input"
					inputmode="decimal"
					name="max"
					placeholder={`$${Math.ceil(props.range.maxDollars)}`}
					value={search().max ?? ""}
				/>
			</div>
			<button class="bd-btn bd-btn--ghost store-price__apply" type="submit">
				Apply
			</button>
		</form>
	);
}

/** 4, 3 or 2 stars & up (?rating). */
export function RatingFilter() {
	const { search, setFilters } = useStoreFilters();
	return (
		<div class="store-facet">
			<p class="store-facet__title">Rating</p>
			<ul class="store-facet__list">
				<For each={[4, 3, 2]}>
					{(r) => {
						const active = () => search().rating === r;
						return (
							<li>
								<button
									aria-pressed={active() ? "true" : "false"}
									class={`store-facet__item store-facet__rating${active() ? " store-facet__item--active" : ""}`}
									onClick={() =>
										setFilters({ rating: active() ? undefined : r })
									}
									type="button"
								>
									<ShopStars rating={r} />
									<span class="store-facet__count">&amp; up</span>
								</button>
							</li>
						);
					}}
				</For>
			</ul>
		</div>
	);
}

/** "Clear all filters", while any filter is on. */
export function ClearFilters() {
	const { search, navigate } = useStoreFilters();
	return (
		<Show when={hasFilters(search())}>
			<button
				class="store-clear"
				onClick={() => navigate({ to: "/store", search: {} })}
				type="button"
			>
				Clear all filters
			</button>
		</Show>
	);
}

/** The sort menu (?sort); it applies as soon as it changes. */
export function SortSelect() {
	const { search, setFilters } = useStoreFilters();
	return (
		<div class="store-sort">
			<label for="store-sort">Sort</label>
			<select
				class="bd-select"
				id="store-sort"
				onChange={(e) => {
					const value = e.currentTarget.value as StorefrontSort;
					setFilters({ sort: value === "featured" ? undefined : value });
				}}
				value={search().sort ?? "featured"}
			>
				<For each={Object.keys(SORT_LABELS) as StorefrontSort[]}>
					{(s) => <option value={s}>{SORT_LABELS[s]}</option>}
				</For>
			</select>
		</div>
	);
}
