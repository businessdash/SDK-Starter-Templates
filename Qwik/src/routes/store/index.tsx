// [bd-file:store]
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
import { ShopStars } from "../../components/bd/ShopStars";
import { SiteHeader } from "../../components/bd/SiteHeader";
import { StoreNav } from "../../components/bd/StoreNav";
import { getBd } from "../../lib/bd";
import { elementHtml } from "../../lib/bd-elements";
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
 * search params (`q`, `category`, `price`, `rating`, `sort`). Each card saves
 * to the wishlist or the comparison (`<bd-save-buttons>`), and
 * `<bd-compare-bar>` shows the picks. Suspension errors degrade to a minimal
 * "unavailable" state instead of crashing.
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
			<SiteHeader signedIn={data.value.signedIn} />
			<StoreNav cartCount={data.value.cartCount} />
			<main class="bd-page">
				<div class="bd-section__lead">
					<span class="bd-section__eyebrow">Shop</span>
					<h1 class="bd-section__title">Products</h1>
					<p class="bd-section__sub">
						Filter, sort, and open a product to choose its options and add it to your cart.
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
						<aside aria-label="Product filters" class="store-sidebar">
							<form
								preventdefault:submit
								role="search"
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
									autoComplete="off"
									class="bd-input"
									id="store-search"
									name="q"
									placeholder="Search products…"
									type="search"
									value={search}
								/>
							</form>

							{data.value.categories.length > 0 ? (
								<div class="store-facet">
									<p class="store-facet__title">Category</p>
									<ul class="store-facet__list">
										<li>
											<button
												aria-pressed={!activeCategory}
												class={`store-facet__item${activeCategory ? "" : " store-facet__item--active"}`}
												onClick$={() => setParam("category", null)}
												type="button"
											>
												All products
											</button>
										</li>
										{data.value.categories.map((c) => {
											const active = activeCategory === c.id;
											return (
												<li key={c.id}>
													<button
														aria-pressed={active}
														class={`store-facet__item store-facet__item--row${active ? " store-facet__item--active" : ""}`}
														onClick$={() => setParam("category", active ? null : c.id)}
														type="button"
													>
														<span>{c.name}</span>
														<span class="store-facet__count">
															{countByCategory.get(c.id) ?? 0}
														</span>
													</button>
												</li>
											);
										})}
									</ul>
								</div>
							) : null}

							<form
								class="store-facet"
								preventdefault:submit
								onSubmit$={() => {
									const min = minPrice.value.trim();
									const max = maxPrice.value.trim();
									setParam("price", min || max ? `${min}-${max}` : null);
								}}
							>
								<p class="store-facet__title">Price</p>
								<div class="store-price">
									<input
										aria-label="Lowest price"
										bind:value={minPrice}
										class="bd-input"
										inputMode="decimal"
										placeholder={`$${Math.floor(data.value.priceRange.minDollars)}`}
									/>
									<span aria-hidden="true" class="store-price__sep">
										–
									</span>
									<input
										aria-label="Highest price"
										bind:value={maxPrice}
										class="bd-input"
										inputMode="decimal"
										placeholder={`$${Math.ceil(data.value.priceRange.maxDollars)}`}
									/>
								</div>
								<button class="bd-btn bd-btn--ghost store-price__apply" type="submit">
									Apply
								</button>
							</form>

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
													onClick$={() => setParam("rating", active ? null : String(r))}
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

							{hasFilters ? (
								<button class="store-clear" onClick$={() => nav("/store")} type="button">
									Clear all filters
								</button>
							) : null}
						</aside>

						<div class="store-results">
							<div class="store-results__bar">
								<p class="bd-loading">
									{data.value.items.length}{" "}
									{data.value.items.length === 1 ? "product" : "products"}
								</p>
								<div class="store-sort">
									<label for="store-sort">Sort</label>
									<select
										class="bd-select"
										id="store-sort"
										onChange$={(e) => {
											const value = (e.target as HTMLSelectElement).value;
											setParam("sort", value === "featured" ? null : value);
										}}
										value={activeSort}
									>
										{SORT_VALUES.map((s) => (
											<option key={s} value={s}>
												{SORT_LABELS[s]}
											</option>
										))}
									</select>
								</div>
							</div>

							{data.value.items.length === 0 ? (
								<div class="bd-empty">
									{hasFilters
										? "No products match these filters. Try clearing a filter or broadening your search."
										: "No live products yet. Add and publish products in the BD dashboard and they'll appear here."}
								</div>
							) : (
								<div class="bd-grid-3">
									{data.value.items.map((p) => (
										<div class="bd-card product-card" key={p.id}>
											<Link class="product-card__link" href={`/store/${p.id}`}>
												<div class="product-card__media">
													{p.coverImage ? (
														<img
															alt={p.name}
															class="product-card__img"
															loading="lazy"
															referrerPolicy="no-referrer"
															src={p.coverImage}
														/>
													) : (
														<div class="product-card__noimg">No image</div>
													)}
													<div class="product-card__badges">
														{p.isBestSeller ? <span class="bd-badge">Best seller</span> : null}
														{p.isNew ? <span class="bd-badge">New</span> : null}
														{p.isOnSale ? (
															<span class="bd-badge product-card__badge--sale">Sale</span>
														) : null}
													</div>
												</div>
												<div class="product-card__body">
													<h3>{p.name || "Untitled"}</h3>
													{p.reviewCount > 0 ? (
														<div class="product-card__rating">
															<ShopStars rating={p.avgRating} />
															<span class="product-card__count">({p.reviewCount})</span>
														</div>
													) : null}
													<div class="product-card__price">
														<span class="product-card__amount">
															{p.cheapestPriceCents != null
																? `${p.hasMultipleVariants ? "From " : ""}${formatMoney(p.cheapestPriceCents, "usd")}`
																: "View details"}
														</span>
														{p.isOnSale && p.comparePriceCents != null ? (
															<span class="product-card__compare">
																{formatMoney(p.comparePriceCents, "usd")}
															</span>
														) : null}
													</div>
													{p.isLowStock ? <span class="product-card__lowstock">Low stock</span> : null}
												</div>
											</Link>
											<div
												class="product-card__save"
												dangerouslySetInnerHTML={elementHtml("bd-save-buttons", {
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
									))}
								</div>
							)}
							<div dangerouslySetInnerHTML={elementHtml("bd-compare-bar", {})} />
						</div>
					</div>
				)}
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
