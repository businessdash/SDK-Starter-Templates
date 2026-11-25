// [bd-file:store]
import type { StorefrontSort } from "@businessdash/sdk/contracts";
import { createFileRoute, Link, useNavigate } from "@tanstack/solid-router";
import { For, Show } from "solid-js";

import { formatMoney } from "../components/bd/money";
import { ShopStars } from "../components/bd/ShopStars";
import { StoreNav } from "../components/bd/StoreNav";
import { elementHtml } from "../lib/bd-elements";
import { getStoreListing } from "../lib/bd-server-fns";
import { getCartCount } from "../lib/bd-shop-fns";

/**
 * Storefront listing — `storefront.listProductsWithMeta` powers the grid
 * (price, compare-at price, ratings, badges) and the filter sidebar (search,
 * categories with counts, price range, rating, sort). The filters live in
 * the URL (?q, ?category, ?min, ?max, ?rating, ?sort), so a filtered list
 * can be shared, and the loader reads the list on the server for each one.
 * Each card saves to the wishlist or the comparison (`<bd-save-buttons>`),
 * and `<bd-compare-bar>` shows the picks.
 */
type StoreSearch = {
	q?: string;
	category?: string;
	min?: number;
	max?: number;
	rating?: number;
	sort?: StorefrontSort;
};

const SORT_LABELS: Record<StorefrontSort, string> = {
	featured: "Featured",
	newest: "Newest",
	"price-asc": "Price: low to high",
	"price-desc": "Price: high to low",
	"rating-desc": "Top rated",
};

function text(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function positive(value: unknown): number | undefined {
	const n = typeof value === "number" ? value : Number(value);
	return Number.isFinite(n) && n > 0 ? n : undefined;
}

export const Route = createFileRoute("/store/")({
	component: StoreIndex,
	validateSearch: (search: Record<string, unknown>): StoreSearch => {
		const sort = text(search.sort);
		return {
			q: text(search.q),
			category: text(search.category),
			min: positive(search.min),
			max: positive(search.max),
			rating: positive(search.rating),
			sort: sort && sort in SORT_LABELS ? (sort as StorefrontSort) : undefined,
		};
	},
	loaderDeps: ({ search }) => search,
	loader: async ({ deps }) => {
		const [listing, cartCount] = await Promise.all([
			getStoreListing({
				data: {
					search: deps.q,
					categoryId: deps.category,
					minPriceCents:
						deps.min != null ? Math.round(deps.min * 100) : undefined,
					maxPriceCents:
						deps.max != null ? Math.round(deps.max * 100) : undefined,
					minRating: deps.rating,
					sort: deps.sort,
				},
			}),
			getCartCount(),
		]);
		return { listing, cartCount };
	},
	head: () => ({ meta: [{ title: "Store" }] }),
});

function StoreIndex() {
	const loaded = Route.useLoaderData();
	const search = Route.useSearch();
	const navigate = useNavigate();

	const data = () => {
		const r = loaded().listing;
		return r.ok ? r : null;
	};
	const reason = () => {
		const r = loaded().listing;
		return r.ok ? null : r.reason;
	};
	const countFor = (categoryId: string) =>
		data()?.categoryCounts.find((c) => c.categoryId === categoryId)?.count ?? 0;
	const hasFilters = () => {
		const s = search();
		return Boolean(
			s.q || s.category || s.rating || s.min != null || s.max != null,
		);
	};

	/** This list with some filters changed (undefined drops one). */
	const setFilters = (next: Partial<StoreSearch>) =>
		navigate({ to: "/store", search: { ...search(), ...next } });

	const onSearch = (e: SubmitEvent) => {
		e.preventDefault();
		const q = String(
			new FormData(e.currentTarget as HTMLFormElement).get("q") ?? "",
		);
		setFilters({ q: text(q) });
	};

	const onPrice = (e: SubmitEvent) => {
		e.preventDefault();
		const fd = new FormData(e.currentTarget as HTMLFormElement);
		setFilters({ min: positive(fd.get("min")), max: positive(fd.get("max")) });
	};

	return (
		<>
			<StoreNav cartCount={loaded().cartCount} />
			<main class="bd-page">
				<div class="bd-section__lead">
					<span class="bd-section__eyebrow">Shop</span>
					<h1 class="bd-section__title">Products</h1>
					<p class="bd-section__sub">
						Filter, sort, and open a product to choose its options and add it to
						your cart.
					</p>
				</div>

				<Show
					when={data()}
					fallback={
						<div class="bd-empty">
							<Show
								when={reason() === "suspended"}
								fallback={
									<>
										Store isn't connected yet. Set <code>BD_API_KEY</code>,{" "}
										<code>BD_SITE_ID</code>, and{" "}
										<code>BD_PACKAGE_API_BASE_URL</code> in <code>.env</code>.
									</>
								}
							>
								This store is temporarily unavailable. Please check back soon.
							</Show>
						</div>
					}
				>
					{(d) => (
						<div class="store-layout">
							<aside aria-label="Product filters" class="store-sidebar">
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

								<Show when={d().categories.length > 0}>
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
											<For each={d().categories}>
												{(c) => {
													const active = () => search().category === c.id;
													return (
														<li>
															<button
																aria-pressed={active() ? "true" : "false"}
																class={`store-facet__item store-facet__item--row${active() ? " store-facet__item--active" : ""}`}
																onClick={() =>
																	setFilters({
																		category: active() ? undefined : c.id,
																	})
																}
																type="button"
															>
																<span>{c.name}</span>
																<span class="store-facet__count">
																	{countFor(c.id)}
																</span>
															</button>
														</li>
													);
												}}
											</For>
										</ul>
									</div>
								</Show>

								<form class="store-facet" onSubmit={onPrice}>
									<p class="store-facet__title">Price</p>
									<div class="store-price">
										<input
											aria-label="Lowest price"
											class="bd-input"
											inputmode="decimal"
											name="min"
											placeholder={`$${Math.floor(d().priceRange.minDollars)}`}
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
											placeholder={`$${Math.ceil(d().priceRange.maxDollars)}`}
											value={search().max ?? ""}
										/>
									</div>
									<button
										class="bd-btn bd-btn--ghost store-price__apply"
										type="submit"
									>
										Apply
									</button>
								</form>

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

								<Show when={hasFilters()}>
									<button
										class="store-clear"
										onClick={() => navigate({ to: "/store", search: {} })}
										type="button"
									>
										Clear all filters
									</button>
								</Show>
							</aside>

							<div class="store-results">
								<div class="store-results__bar">
									<p class="bd-loading">
										{d().items.length}{" "}
										{d().items.length === 1 ? "product" : "products"}
									</p>
									<div class="store-sort">
										<label for="store-sort">Sort</label>
										<select
											class="bd-select"
											id="store-sort"
											onChange={(e) => {
												const value = e.currentTarget.value as StorefrontSort;
												setFilters({
													sort: value === "featured" ? undefined : value,
												});
											}}
											value={search().sort ?? "featured"}
										>
											<For each={Object.keys(SORT_LABELS) as StorefrontSort[]}>
												{(s) => <option value={s}>{SORT_LABELS[s]}</option>}
											</For>
										</select>
									</div>
								</div>

								<Show
									when={d().items.length > 0}
									fallback={
										<div class="bd-empty">
											{hasFilters()
												? "No products match these filters. Try clearing a filter or broadening your search."
												: "No live products yet. Add and publish products in the BD dashboard and they'll appear here."}
										</div>
									}
								>
									<div class="bd-grid-3">
										<For each={d().items}>
											{(p) => (
												<div class="bd-card product-card">
													<Link
														class="product-card__link"
														params={{ id: p.id }}
														to="/store/$id"
													>
														<div class="product-card__media">
															<Show
																when={p.coverImage}
																fallback={
																	<div class="product-card__noimg">
																		No image
																	</div>
																}
															>
																<img
																	alt={p.name}
																	class="product-card__img"
																	loading="lazy"
																	referrerpolicy="no-referrer"
																	src={p.coverImage ?? ""}
																/>
															</Show>
															<div class="product-card__badges">
																<Show when={p.isBestSeller}>
																	<span class="bd-badge">Best seller</span>
																</Show>
																<Show when={p.isNew}>
																	<span class="bd-badge">New</span>
																</Show>
																<Show when={p.isOnSale}>
																	<span class="bd-badge product-card__badge--sale">
																		Sale
																	</span>
																</Show>
															</div>
														</div>
														<div class="product-card__body">
															<h3>{p.name || "Untitled"}</h3>
															<Show when={p.reviewCount > 0}>
																<div class="product-card__rating">
																	<ShopStars rating={p.avgRating} />
																	<span class="product-card__count">
																		({p.reviewCount})
																	</span>
																</div>
															</Show>
															<div class="product-card__price">
																<span class="product-card__amount">
																	{p.cheapestPriceCents != null
																		? `${p.hasMultipleVariants ? "From " : ""}${formatMoney(p.cheapestPriceCents)}`
																		: "View details"}
																</span>
																<Show
																	when={
																		p.isOnSale && p.comparePriceCents != null
																	}
																>
																	<span class="product-card__compare">
																		{formatMoney(p.comparePriceCents ?? 0)}
																	</span>
																</Show>
															</div>
															<Show when={p.isLowStock}>
																<span class="product-card__lowstock">
																	Low stock
																</span>
															</Show>
														</div>
													</Link>
													<div
														class="product-card__save"
														innerHTML={elementHtml("bd-save-buttons", {
															compact: true,
															"data-product": JSON.stringify({
																id: p.id,
																name: p.name,
																image: p.coverImage ?? null,
																priceCents: p.cheapestPriceCents ?? null,
															}),
														})}
													/>
												</div>
											)}
										</For>
									</div>
								</Show>
								<div innerHTML={elementHtml("bd-compare-bar", {})} />
							</div>
						</div>
					)}
				</Show>
			</main>
		</>
	);
}
