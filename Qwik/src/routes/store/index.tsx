// [bd-file:store]
import { component$ } from "@builder.io/qwik";
import { type DocumentHead, routeLoader$ } from "@builder.io/qwik-city";

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
import { CompareBar } from "../../components/bd/shop/CompareBar";
import { ProductGrid } from "../../components/bd/shop/ProductGrid";
import {
	CategoryFilter,
	ClearFilters,
	PriceFilter,
	RatingFilter,
	SORT_VALUES,
	SortSelect,
	StoreSearch,
	useStoreFilters,
} from "../../components/bd/shop/StoreFilters";
import { SiteHeader } from "../../components/bd/SiteHeader";
import { StoreNav } from "../../components/bd/StoreNav";
import { getBd } from "../../lib/bd";
import {
	getCartSnapshot,
	listStoreCategories,
	listStoreProductsWithMeta,
} from "../../lib/bd-store";
import { getCustomerSession } from "../../lib/bd-portal";

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
 * search params (`q`, `category`, `price`, `rating`, `sort`). The page is laid
 * out from the shop's parts (src/components/bd/shop/): the filters, the grid
 * of product cards (each saves to the wishlist or the comparison), and the
 * compare bar. Suspension errors degrade to a minimal "unavailable" state
 * instead of crashing.
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
	const minRating = query.get("rating")
		? Number(query.get("rating"))
		: undefined;
	const sortParam = query.get("sort") as StorefrontSort | null;
	const sort =
		sortParam && SORT_VALUES.includes(sortParam) ? sortParam : undefined;
	const { minDollars, maxDollars } = parsePrice(
		query.get("price") ?? undefined,
	);

	try {
		const [meta, categories, cart, session] = await Promise.all([
			listStoreProductsWithMeta({
				...(search ? { search } : {}),
				...(categoryId ? { categoryId } : {}),
				...(minRating ? { minRating } : {}),
				...(sort ? { sort } : {}),
				...(minDollars != null
					? { minPriceCents: Math.round(minDollars * 100) }
					: {}),
				...(maxDollars != null
					? { maxPriceCents: Math.round(maxDollars * 100) }
					: {}),
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
	const { active: hasFilters } = useStoreFilters();

	return (
		<>
			<SiteHeader signedIn={data.value.signedIn} />
			<StoreNav cartCount={data.value.cartCount} />
			<main class="bd-page">
				<div class="bd-section__lead">
					<span class="bd-section__eyebrow">Shop</span>
					<h1 class="bd-section__title">Products</h1>
					<p class="bd-section__sub">
						Filter, sort, and open a product to choose its options and add it to
						your cart.
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
							<StoreSearch />
							<CategoryFilter
								categories={data.value.categories}
								counts={data.value.categoryCounts}
							/>
							<PriceFilter range={data.value.priceRange} />
							<RatingFilter />
							<ClearFilters />
						</aside>

						<div class="store-results">
							<div class="store-results__bar">
								<p class="bd-loading">
									{data.value.items.length}{" "}
									{data.value.items.length === 1 ? "product" : "products"}
								</p>
								<SortSelect />
							</div>

							{data.value.items.length === 0 ? (
								<div class="bd-empty">
									{hasFilters
										? "No products match these filters. Try clearing a filter or broadening your search."
										: "No live products yet. Add and publish products in the BD dashboard and they'll appear here."}
								</div>
							) : (
								<ProductGrid products={data.value.items} />
							)}
							<CompareBar />
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
