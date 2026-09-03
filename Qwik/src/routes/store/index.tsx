import { $, component$, useSignal } from "@builder.io/qwik";
import {
	type DocumentHead,
	Link,
	routeLoader$,
	useLocation,
	useNavigate,
} from "@builder.io/qwik-city";

import {
	BdPaymentLapsedError,
	BdServiceSuspendedError,
} from "@businessdash/sdk";
import type {
	StorefrontCategory,
	StorefrontProductCard,
	StorefrontSort,
} from "@businessdash/sdk/contracts";

import { Footer } from "../../components/bd/Footer";
import { SiteHeader } from "../../components/bd/SiteHeader";
import { Stars } from "../../components/bd/Stars";
import { getBd } from "../../lib/bd";
import {
	formatMoney,
	getCartSnapshot,
	listStoreCategories,
	listStoreProductsWithMeta,
} from "../../lib/bd-store";
import { getCustomerSession } from "../../lib/bd-portal";

const SORT_VALUES: readonly StorefrontSort[] = [
	"featured",
	"newest",
	"price-asc",
	"price-desc",
	"rating-desc",
];

const SORT_LABELS: Record<StorefrontSort, string> = {
	featured: "Featured",
	newest: "Newest",
	"price-asc": "Price: low to high",
	"price-desc": "Price: high to low",
	"rating-desc": "Top rated",
};

/** Parse a `min-max` price param (either side optional) into dollar bounds. */
function parsePrice(raw: string | undefined): {
	minDollars: number | null;
	maxDollars: number | null;
} {
	if (!raw) return { minDollars: null, maxDollars: null };
	const [min, max] = raw.split("-");
	const toNum = (s: string | undefined) => {
		const n = Number((s ?? "").trim());
		return Number.isFinite(n) && s?.trim() ? n : null;
	};
	return { minDollars: toNum(min), maxDollars: toNum(max) };
}

/**
 * Storefront product list. `routeLoader$` reads the filterable catalog
 * server-side via `storefront.listProductsWithMeta` (facets + ratings +
 * badges) plus the category list for the sidebar. Filters are driven by URL
 * search params (`q`, `category`, `price`, `rating`, `sort`). Suspension
 * errors degrade to a minimal "unavailable" state instead of crashing.
 */
export const useStoreData = routeLoader$(async ({ cookie, query }) => {
	const bd = getBd();
	const empty = {
		configured: false,
		suspended: false,
		items: [] as StorefrontProductCard[],
		categories: [] as StorefrontCategory[],
		categoryCounts: [] as Array<{ categoryId: string; count: number }>,
		priceRange: { minDollars: 0, maxDollars: 0 },
		cartCount: 0,
		signedIn: false,
	} as const;

	if (!bd) return empty;

	const search = query.get("q")?.trim() || undefined;
	const categoryId = query.get("category") || undefined;
	const minRating = query.get("rating") ? Number(query.get("rating")) : undefined;
	const sortParam = query.get("sort") as StorefrontSort | null;
	const sort =
		sortParam && SORT_VALUES.includes(sortParam) ? sortParam : undefined;
	const { minDollars, maxDollars } = parsePrice(query.get("price") ?? undefined);

	try {
		const [meta, categories, cart, session] = await Promise.all([
			listStoreProductsWithMeta({
				...(search ? { search } : {}),
				...(categoryId ? { categoryId } : {}),
				...(minRating ? { minRating } : {}),
				...(sort ? { sort } : {}),
				...(minDollars != null ? { minPriceCents: Math.round(minDollars * 100) } : {}),
				...(maxDollars != null ? { maxPriceCents: Math.round(maxDollars * 100) } : {}),
				limit: 48,
			}),
			listStoreCategories(),
			getCartSnapshot(cookie),
			getCustomerSession(cookie),
		]);

		if (!meta) {
			return { ...empty, configured: true } as const;
		}

		return {
			configured: true,
			suspended: false,
			items: meta.items,
			categories: categories?.items ?? [],
			categoryCounts: meta.categoryCounts,
			priceRange: meta.priceRange,
			cartCount: cart?.itemCount ?? 0,
			signedIn: !!session,
		} as const;
	} catch (err) {
		if (
			err instanceof BdServiceSuspendedError ||
			err instanceof BdPaymentLapsedError
		) {
			return { ...empty, configured: true, suspended: true } as const;
		}
		return { ...empty, configured: true } as const;
	}
});

export default component$(() => {
	const data = useStoreData();
	const loc = useLocation();
	const nav = useNavigate();

	const search = loc.url.searchParams.get("q") ?? "";
	const activeCategory = loc.url.searchParams.get("category") ?? "";
	const activeRating = Number(loc.url.searchParams.get("rating") ?? "0");
	const activeSort = (loc.url.searchParams.get("sort") as StorefrontSort) ?? "featured";
	const price = loc.url.searchParams.get("price") ?? "";
	const [minPriceStr = "", maxPriceStr = ""] = price.split("-");

	const minPrice = useSignal(minPriceStr);
	const maxPrice = useSignal(maxPriceStr);

	const hasFilters = Boolean(search || activeCategory || activeRating || price);

	/** Replace one search param (drop when empty/featured) and navigate. */
	const setParam = $(async (key: string, value: string | null) => {
		const params = new URLSearchParams(loc.url.searchParams);
		if (value === null || value === "") params.delete(key);
		else params.set(key, value);
		const qs = params.toString();
		await nav(qs ? `/store?${qs}` : "/store");
	});

	const countByCategory = new Map(
		data.value.categoryCounts.map((c) => [c.categoryId, c.count]),
	);

	return (
		<>
			<SiteHeader signedIn={data.value.signedIn} cartCount={data.value.cartCount} />
			<main>
				<section class="bd-section">
					<div class="bd-section__lead">
						<span class="bd-section__eyebrow">Shop</span>
						<h2 class="bd-section__title">Store</h2>
						<p class="bd-section__sub">
							Live products from the BD storefront surface. Filter, add to cart,
							and check out via Stripe.
						</p>
					</div>

					{data.value.suspended ? (
						<div class="bd-empty">
							The store is temporarily unavailable. Please check back soon.
						</div>
					) : !data.value.configured ? (
						<div class="bd-empty">
							Store isn't connected yet. Set the BD env vars (see
							<code> .env.example</code>) to go live.
						</div>
					) : (
						<div class="store-layout">
							{/* Sidebar — search, categories, price, rating */}
							<aside class="store-sidebar">
								<form
									class="store-filter"
									preventdefault:submit
									onSubmit$={(e) => {
										const fd = new FormData(e.target as HTMLFormElement);
										const q = String(fd.get("q") ?? "").trim();
										setParam("q", q || null);
									}}
								>
									<label class="bd-label" for="store-search">
										Search
									</label>
									<input
										class="bd-input"
										id="store-search"
										name="q"
										placeholder="Search products…"
										type="search"
										value={search}
									/>
								</form>

								{data.value.categories.length > 0 ? (
									<div class="store-filter">
										<p class="store-filter__title">Category</p>
										<ul class="store-filter__list">
											<li>
												<button
													aria-pressed={!activeCategory}
													class="store-filter__link"
													onClick$={() => setParam("category", null)}
													type="button"
												>
													<span>All products</span>
												</button>
											</li>
											{data.value.categories.map((c) => {
												const active = activeCategory === c.id;
												const count = countByCategory.get(c.id) ?? 0;
												return (
													<li key={c.id}>
														<button
															aria-pressed={active}
															class="store-filter__link"
															onClick$={() =>
																setParam("category", active ? null : c.id)
															}
															type="button"
														>
															<span>{c.name}</span>
															<span class="store-filter__count">{count}</span>
														</button>
													</li>
												);
											})}
										</ul>
									</div>
								) : null}

								<form
									class="store-filter"
									preventdefault:submit
									onSubmit$={() => {
										const min = minPrice.value.trim();
										const max = maxPrice.value.trim();
										setParam("price", min || max ? `${min}-${max}` : null);
									}}
								>
									<p class="store-filter__title">Price</p>
									<div class="store-filter__price">
										<input
											bind:value={minPrice}
											class="bd-input"
											inputMode="numeric"
											placeholder={`$${data.value.priceRange.minDollars}`}
										/>
										<span class="store-filter__dash">–</span>
										<input
											bind:value={maxPrice}
											class="bd-input"
											inputMode="numeric"
											placeholder={`$${data.value.priceRange.maxDollars}`}
										/>
									</div>
									<button
										class="bd-btn bd-btn--ghost store-filter__apply"
										type="submit"
									>
										Apply
									</button>
								</form>

								<div class="store-filter">
									<p class="store-filter__title">Rating</p>
									<ul class="store-filter__list">
										{[4, 3, 2].map((r) => {
											const active = activeRating === r;
											return (
												<li key={r}>
													<button
														aria-pressed={active}
														class="store-filter__link"
														onClick$={() =>
															setParam("rating", active ? null : String(r))
														}
														type="button"
													>
														<Stars rating={r} />
														<span class="store-filter__count">&amp; up</span>
													</button>
												</li>
											);
										})}
									</ul>
								</div>

								{hasFilters ? (
									<button
										class="store-filter__clear"
										onClick$={() => nav("/store")}
										type="button"
									>
										Clear all filters
									</button>
								) : null}
							</aside>

							{/* Grid */}
							<div class="store-results">
								<div class="store-results__bar">
									<p class="store-results__count">
										{data.value.items.length}{" "}
										{data.value.items.length === 1 ? "product" : "products"}
									</p>
									<label class="store-results__sort">
										<span>Sort</span>
										<select
											class="bd-select"
											onChange$={(e) =>
												setParam(
													"sort",
													(e.target as HTMLSelectElement).value === "featured"
														? null
														: (e.target as HTMLSelectElement).value,
												)
											}
											value={activeSort}
										>
											{SORT_VALUES.map((s) => (
												<option key={s} value={s}>
													{SORT_LABELS[s]}
												</option>
											))}
										</select>
									</label>
								</div>

								{data.value.items.length === 0 ? (
									<div class="bd-empty">
										No products match these filters. Try clearing a filter or
										broadening your search.
									</div>
								) : (
									<div class="bd-grid-3">
										{data.value.items.map((p) => (
											<Link
												class="bd-card service-card store-card"
												href={`/store/${p.id}`}
												key={p.id}
											>
												<div class="store-card__media">
													{p.coverImage ? (
														<img
															alt={p.name}
															loading="lazy"
															referrerPolicy="no-referrer"
															src={p.coverImage}
														/>
													) : (
														<div class="store-card__placeholder">No image</div>
													)}
													{p.isBestSeller || p.isNew || p.isOnSale ? (
														<div class="store-card__badges">
															{p.isBestSeller ? (
																<span class="bd-badge">Best seller</span>
															) : null}
															{p.isNew ? (
																<span class="bd-badge">New</span>
															) : null}
															{p.isOnSale ? (
																<span class="bd-badge store-card__badge--sale">
																	Sale
																</span>
															) : null}
														</div>
													) : null}
												</div>
												<h3>{p.name}</h3>
												{p.reviewCount > 0 ? (
													<div class="store-card__rating">
														<Stars rating={p.avgRating} />
														<span class="store-card__reviews">
															({p.reviewCount})
														</span>
													</div>
												) : null}
												<div class="store-card__price">
													<span class="service-card__price">
														{p.hasMultipleVariants ? "From " : ""}
														{p.cheapestPriceCents != null
															? formatMoney(p.cheapestPriceCents, "usd")
															: "—"}
													</span>
													{p.isOnSale && p.comparePriceCents != null ? (
														<span class="store-card__compare">
															{formatMoney(p.comparePriceCents, "usd")}
														</span>
													) : null}
												</div>
												{p.isLowStock ? (
													<span class="store-card__lowstock">Low stock</span>
												) : null}
											</Link>
										))}
									</div>
								)}
							</div>
						</div>
					)}
				</section>
			</main>
			<Footer />
		</>
	);
});

export const head: DocumentHead = {
	title: "Store — Your Business",
	meta: [
		{
			name: "description",
			content:
				"Browse and filter products from the BD storefront. Server-rendered via routeLoader$ with a visitor-token cart.",
		},
	],
};
