// [bd-file:store]

import type {
	LinksFunction,
	LoaderFunctionArgs,
	MetaFunction,
} from "react-router";
import { useLoaderData } from "react-router";

import shopStyles from "~/bd-shop.css?url";
import { SiteHeader } from "~/components/SiteHeader";
import { StoreNav } from "~/components/StoreNav";
import { CompareBar } from "~/components/shop/CompareBar";
import { ProductGrid } from "~/components/shop/ProductGrid";
import {
	CategoryFilter,
	ClearFilters,
	PriceFilter,
	RatingFilter,
	SORTS,
	SortSelect,
	StoreSearch,
	useHasFilters,
} from "~/components/shop/StoreFilters";
import {
	getCartSnapshot,
	listStoreCategories,
	listStoreProductsWithMeta,
} from "~/lib/bd-store.server";

export const links: LinksFunction = () => [
	{ rel: "stylesheet", href: shopStyles },
];

export const meta: MetaFunction = () => [
	{ title: "Store — Your Business" },
	{ name: "description", content: "Browse products and services." },
];

type Sort = (typeof SORTS)[number]["value"];

function parseSort(raw: string | null): Sort {
	return SORTS.some((s) => s.value === raw) ? (raw as Sort) : "featured";
}

function parseCents(raw: string | null): number | undefined {
	if (!raw) return undefined;
	const dollars = Number.parseFloat(raw);
	return Number.isFinite(dollars) ? Math.round(dollars * 100) : undefined;
}

/**
 * The product list. Every filter is in the URL (?q, ?category, ?min, ?max,
 * ?rating, ?sort): categories and ratings are links and search, price and
 * sort are GET forms, so filtering works without JavaScript and a filtered
 * list can be shared.
 */
export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url);
	const search = url.searchParams.get("q")?.trim() || undefined;
	const categoryId = url.searchParams.get("category") || undefined;
	const sort = parseSort(url.searchParams.get("sort"));
	const minPriceCents = parseCents(url.searchParams.get("min"));
	const maxPriceCents = parseCents(url.searchParams.get("max"));
	const ratingRaw = Number.parseInt(url.searchParams.get("rating") ?? "", 10);
	const minRating =
		Number.isFinite(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5
			? ratingRaw
			: undefined;

	const [meta, categories, cart] = await Promise.all([
		listStoreProductsWithMeta({
			limit: 48,
			...(search ? { search } : {}),
			...(categoryId ? { categoryId } : {}),
			...(minPriceCents != null ? { minPriceCents } : {}),
			...(maxPriceCents != null ? { maxPriceCents } : {}),
			...(minRating ? { minRating } : {}),
			sort,
		}),
		listStoreCategories(),
		getCartSnapshot(request),
	]);

	const counts = new Map(
		(meta?.categoryCounts ?? []).map((c) => [c.categoryId, c.count]),
	);
	return {
		connected: meta !== null,
		products: meta?.items ?? [],
		categories: (categories?.items ?? []).map((c) => ({
			id: c.id,
			name: c.name,
			count: counts.get(c.id) ?? 0,
		})),
		priceRange: meta?.priceRange ?? null,
		cartCount: cart?.itemCount ?? 0,
	};
}

/**
 * The store page, laid out from the shop's parts: the filters
 * (~/components/shop/StoreFilters), the grid of <ProductCard>s and the
 * compare bar. Move, restyle or drop any of them.
 */
export default function StoreIndex() {
	const { connected, products, categories, priceRange, cartCount } =
		useLoaderData<typeof loader>();
	const hasFilters = useHasFilters();

	return (
		<>
			<SiteHeader />
			<StoreNav cartCount={cartCount} />
			<main className="bd-page">
				<div className="bd-section__lead">
					<span className="bd-section__eyebrow">Shop</span>
					<h1 className="bd-section__title">Products</h1>
					<p className="bd-section__sub">
						Filter, sort, and open a product to choose its options and add it to
						your cart.
					</p>
				</div>

				{!connected ? (
					<div className="bd-empty">
						Store isn't connected yet. Add your BD env to list products.
					</div>
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
									{products.length}{" "}
									{products.length === 1 ? "product" : "products"}
								</p>
								<SortSelect />
							</div>

							{products.length === 0 ? (
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
