// [bd-file:store]
"use client";

import { useMemo } from "react";

import { CompareBar } from "@/app/_components/bd/shop/CompareBar";

import { Notice } from "./Notice";
import { ProductGrid } from "./ProductGrid";
import {
	CategoryFilter,
	ClearFilters,
	PriceFilter,
	RatingFilter,
	SortSelect,
	StoreSearch,
} from "./StoreFilters";

/** Enriched grid card from `storefront.listProductsWithMeta`. */
export type StoreCard = {
	id: string;
	name: string;
	description: string | null;
	categoryId: string | null;
	coverImage: string | null;
	cheapestPriceCents: number | null;
	comparePriceCents: number | null;
	isOnSale: boolean;
	isLowStock: boolean;
	hasMultipleVariants: boolean;
	avgRating: number;
	reviewCount: number;
	isBestSeller: boolean;
	isNew: boolean;
};

export type StoreViewMeta = {
	items: StoreCard[];
	categoryCounts: Array<{ categoryId: string; count: number }>;
	priceRange: { minDollars: number; maxDollars: number };
};

export type StoreSort =
	| "featured"
	| "newest"
	| "price-asc"
	| "price-desc"
	| "rating-desc";

export type StoreViewFilters = {
	search?: string;
	categoryId?: string;
	sort?: StoreSort;
	minRating?: number;
	minDollars?: number;
	maxDollars?: number;
};

export type StoreViewStatus = "ok" | "unconfigured" | "failed";

/**
 * The product list: search, category, price and rating filters with a sort,
 * all in the URL (?q, ?category, ?price, ?rating, ?sort), so a filtered list
 * can be shared. Each card can be saved or added to the comparison.
 *
 * It's laid out from the shop's parts: the filters (./StoreFilters), the
 * grid of <ProductCard>s and the compare bar. Move, restyle or drop any.
 */
export function StoreView({
	status,
	meta,
	categories,
	filters,
}: {
	status: StoreViewStatus;
	meta: StoreViewMeta;
	categories: Array<{ id: string; name: string }>;
	filters: StoreViewFilters;
}) {
	const countByCategory = useMemo(
		() => new Map(meta.categoryCounts.map((c) => [c.categoryId, c.count])),
		[meta.categoryCounts],
	);

	const hasFilters = Boolean(
		filters.search ||
			filters.categoryId ||
			filters.minRating ||
			filters.minDollars != null ||
			filters.maxDollars != null,
	);

	return (
		<>
			<div className="bd-section__lead">
				<span className="bd-section__eyebrow">Shop</span>
				<h1 className="bd-section__title">Products</h1>
				<p className="bd-section__sub">
					Filter, sort, and open a product to choose its options and add it to
					your cart.
				</p>
			</div>

			{status === "unconfigured" ? (
				<Notice
					body="BD env (BD_API_KEY / BD_SITE_ID / base URL) isn't set, so the SDK client can't initialise. See .env.example."
					title="Store isn't connected"
				/>
			) : status === "failed" ? (
				<Notice
					body="storefront.listProductsWithMeta() threw — likely the org isn't entitled to the storefront feature, or the package API is unreachable. Check the server logs."
					title="Listing failed"
				/>
			) : (
				<div className="store-layout">
					<aside className="store-sidebar">
						<StoreSearch search={filters.search} />
						<CategoryFilter
							categories={categories}
							categoryId={filters.categoryId}
							counts={countByCategory}
						/>
						<PriceFilter
							maxDollars={filters.maxDollars}
							minDollars={filters.minDollars}
							range={meta.priceRange}
						/>
						<RatingFilter minRating={filters.minRating} />
						<ClearFilters active={hasFilters} />
					</aside>

					<div className="store-results">
						<div className="store-results__bar">
							<p className="bd-loading">
								{meta.items.length}{" "}
								{meta.items.length === 1 ? "product" : "products"}
							</p>
							<SortSelect sort={filters.sort} />
						</div>

						{meta.items.length === 0 ? (
							<div className="bd-empty">
								{hasFilters
									? "No products match these filters. Try clearing a filter or broadening your search."
									: "No live products yet. Add and publish products in the BD dashboard and they'll appear here."}
							</div>
						) : (
							<ProductGrid products={meta.items} />
						)}
						<CompareBar />
					</div>
				</div>
			)}
		</>
	);
}
