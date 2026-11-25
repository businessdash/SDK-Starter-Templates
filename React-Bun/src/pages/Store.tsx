// [bd-file:store]
import { StoreNav } from "../components/StoreNav";
import { CompareBar } from "../components/shop/CompareBar";
import type { ProductCardData } from "../components/shop/ProductCard";
import { ProductGrid } from "../components/shop/ProductGrid";
import {
	CategoryFilter,
	ClearFilters,
	hasFilters as filtersOn,
	PriceFilter,
	parseRating,
	parseSort,
	RatingFilter,
	SortSelect,
	StoreSearch,
} from "../components/shop/StoreFilters";
import { bd } from "../lib/bd";
import { useSearchParams } from "../lib/router";
import { ErrorBox, useApi } from "./ui";

function parseCents(raw: string | null): number | undefined {
	if (!raw) return undefined;
	const dollars = Number.parseFloat(raw);
	return Number.isFinite(dollars) ? Math.round(dollars * 100) : undefined;
}

/**
 * The product list, laid out from the shop's parts: the filters
 * (components/shop/StoreFilters), the grid of <ProductCard>s and the compare
 * bar. Every filter is in the URL (?q, ?category, ?min, ?max, ?rating,
 * ?sort), so a filtered list can be shared and the back button steps
 * through filters.
 */
export function Store() {
	const params = useSearchParams();
	const search = params.get("q")?.trim() || undefined;
	const categoryId = params.get("category") || undefined;
	const sort = parseSort(params.get("sort"));
	const minPriceCents = parseCents(params.get("min"));
	const maxPriceCents = parseCents(params.get("max"));
	const minRating = parseRating(params.get("rating"));
	const hasFilters = filtersOn(params);

	const { data, error, loading } = useApi(
		() =>
			bd.storefront.listProductsWithMeta({
				limit: 48,
				...(search ? { search } : {}),
				...(categoryId ? { categoryId } : {}),
				...(minPriceCents != null ? { minPriceCents } : {}),
				...(maxPriceCents != null ? { maxPriceCents } : {}),
				...(minRating ? { minRating } : {}),
				sort,
			}),
		[search, categoryId, minPriceCents, maxPriceCents, minRating, sort],
	);
	// Categories load once for the sidebar; the listing brings their counts.
	const { data: catData } = useApi(() => bd.storefront.listCategories(), []);

	const products: ProductCardData[] = data?.items ?? [];
	const counts = new Map<string, number>(
		((data?.categoryCounts ?? []) as { categoryId: string; count: number }[]).map((c) => [c.categoryId, c.count]),
	);
	const categories = ((catData?.items ?? []) as { id: string; name: string }[]).map((c) => ({
		id: c.id,
		name: c.name,
		count: counts.get(c.id) ?? 0,
	}));
	const priceRange = data?.priceRange as { minDollars: number; maxDollars: number } | undefined;

	return (
		<>
			<StoreNav />
			<main className="bd-page">
				<div className="bd-section__lead">
					<span className="bd-section__eyebrow">Shop</span>
					<h1 className="bd-section__title">Products</h1>
					<p className="bd-section__sub">
						Filter, sort, and open a product to choose its options and add it to your cart.
					</p>
				</div>

				{error && !data ? (
					<ErrorBox error={error} />
				) : (
					<div className="store-layout">
						<aside className="store-sidebar">
							<StoreSearch />
							<CategoryFilter categories={categories} />
							<PriceFilter range={priceRange} />
							<RatingFilter />
							<ClearFilters />
						</aside>

						<div className="store-results">
							<div className="store-results__bar">
								<p className="bd-loading">
									{loading && !data
										? "Loading products…"
										: `${products.length} ${products.length === 1 ? "product" : "products"}`}
								</p>
								<SortSelect />
							</div>

							{!data ? null : products.length === 0 ? (
								<div className="bd-empty">
									{hasFilters
										? "No products match these filters. Try clearing a filter or broadening your search."
										: "No live products yet. Add and publish products in the BD dashboard and they'll appear here."}
								</div>
							) : (
								<ProductGrid products={products} />
							)}
							<CompareBar />
						</div>
					</div>
				)}
			</main>
		</>
	);
}
