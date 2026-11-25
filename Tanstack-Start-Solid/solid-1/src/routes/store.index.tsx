// [bd-file:store]
import type { StorefrontSort } from "@businessdash/sdk/contracts";
import { createFileRoute } from "@tanstack/solid-router";
import { Show } from "solid-js";

import { CompareBar } from "../components/bd/shop/CompareBar";
import { ProductGrid } from "../components/bd/shop/ProductGrid";
import {
	CategoryFilter,
	ClearFilters,
	hasFilters,
	PriceFilter,
	positive,
	RatingFilter,
	SORT_LABELS,
	SortSelect,
	type StoreSearch,
	StoreSearch as SearchBox,
	text,
} from "../components/bd/shop/StoreFilters";
import { StoreNav } from "../components/bd/StoreNav";
import { getStoreListing } from "../lib/bd-server-fns";
import { getCartCount } from "../lib/bd-shop-fns";

/**
 * Storefront listing — `storefront.listProductsWithMeta` powers the grid
 * (price, compare-at price, ratings, badges) and the filter sidebar (search,
 * categories with counts, price range, rating, sort). The filters live in
 * the URL (?q, ?category, ?min, ?max, ?rating, ?sort), so a filtered list
 * can be shared, and the loader reads the list on the server for each one.
 *
 * The page is laid out from the shop's parts (src/components/bd/shop/): the
 * filters, the grid of <ProductCard>s, and the compare bar. Move, restyle or
 * drop any.
 */
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

	const data = () => {
		const r = loaded().listing;
		return r.ok ? r : null;
	};
	const reason = () => {
		const r = loaded().listing;
		return r.ok ? null : r.reason;
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
								<SearchBox />
								<CategoryFilter
									categories={d().categories}
									counts={d().categoryCounts}
								/>
								<PriceFilter range={d().priceRange} />
								<RatingFilter />
								<ClearFilters />
							</aside>

							<div class="store-results">
								<div class="store-results__bar">
									<p class="bd-loading">
										{d().items.length}{" "}
										{d().items.length === 1 ? "product" : "products"}
									</p>
									<SortSelect />
								</div>

								<Show
									when={d().items.length > 0}
									fallback={
										<div class="bd-empty">
											{hasFilters(search())
												? "No products match these filters. Try clearing a filter or broadening your search."
												: "No live products yet. Add and publish products in the BD dashboard and they'll appear here."}
										</div>
									}
								>
									<ProductGrid products={d().items} />
								</Show>
								<CompareBar />
							</div>
						</div>
					)}
				</Show>
			</main>
		</>
	);
}
