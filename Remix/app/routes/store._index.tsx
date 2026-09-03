import { Form, Link, useLoaderData, useSearchParams } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";

import { SiteHeader } from "~/components/SiteHeader";
import { formatCents } from "~/lib/format";
import {
	getCartSnapshot,
	listStoreCategories,
	listStoreProductsWithMeta,
} from "~/lib/bd-store.server";

export const meta: MetaFunction = () => [
	{ title: "Store — Your Business" },
	{ name: "description", content: "Browse products and services." },
];

const SORTS = [
	{ value: "featured", label: "Featured" },
	{ value: "newest", label: "Newest" },
	{ value: "price-asc", label: "Price: low to high" },
	{ value: "price-desc", label: "Price: high to low" },
	{ value: "rating-desc", label: "Top rated" },
] as const;

type Sort = (typeof SORTS)[number]["value"];

function parseSort(raw: string | null): Sort {
	return SORTS.some((s) => s.value === raw) ? (raw as Sort) : "featured";
}

function parseCents(raw: string | null): number | undefined {
	if (!raw) return undefined;
	const dollars = Number.parseFloat(raw);
	return Number.isFinite(dollars) ? Math.round(dollars * 100) : undefined;
}

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url);
	const search = url.searchParams.get("q")?.trim() || undefined;
	const categoryId = url.searchParams.get("category") || undefined;
	const sort = parseSort(url.searchParams.get("sort"));
	const minPriceCents = parseCents(url.searchParams.get("min"));
	const maxPriceCents = parseCents(url.searchParams.get("max"));
	const minRatingRaw = url.searchParams.get("rating");
	const minRating = minRatingRaw ? Number.parseInt(minRatingRaw, 10) : undefined;

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

	const categoryNames = new Map<string, string>(
		(categories?.items ?? []).map((c) => [c.id, c.name]),
	);

	return {
		connected: meta !== null,
		products: (meta?.items ?? []).map((p) => ({
			id: p.id,
			name: p.name,
			image: p.coverImage,
			priceLabel:
				p.cheapestPriceCents != null
					? formatCents(p.cheapestPriceCents)
					: "View details",
			comparePriceLabel:
				p.isOnSale && p.comparePriceCents != null
					? formatCents(p.comparePriceCents)
					: null,
			fromPrice: p.hasMultipleVariants,
			avgRating: p.avgRating,
			reviewCount: p.reviewCount,
			isBestSeller: p.isBestSeller,
			isNew: p.isNew,
			isLowStock: p.isLowStock,
		})),
		categories: (meta?.categoryCounts ?? []).map((c) => ({
			id: c.categoryId,
			name: categoryNames.get(c.categoryId) ?? "Category",
			count: c.count,
		})),
		priceRange: meta?.priceRange ?? null,
		cartCount: cart?.itemCount ?? 0,
	};
}

export default function StoreIndex() {
	const { connected, products, categories, priceRange, cartCount } =
		useLoaderData<typeof loader>();
	const [params] = useSearchParams();
	const activeCategory = params.get("category");
	const activeRating = params.get("rating");

	return (
		<>
			<SiteHeader cartCount={cartCount} />
			<main>
				<section className="section">
					<div className="section__head">
						<h1 className="section__title">Store</h1>
						<Link className="muted" to="/store/subscriptions">
							Subscriptions →
						</Link>
					</div>

					{!connected ? (
						<p className="muted">
							Store isn't connected yet. Add your BD env to list products.
						</p>
					) : (
						<div className="store-layout">
							{/* Facet sidebar — GET form so filters live in the URL. */}
							<aside>
								<Form method="get" className="store-facets">
									<div className="facet">
										<h3>Search</h3>
										<input
											type="search"
											name="q"
											defaultValue={params.get("q") ?? ""}
											placeholder="Search products"
										/>
									</div>

									{categories.length > 0 ? (
										<div className="facet">
											<h3>Categories</h3>
											<ul className="facet-cats">
												<li>
													<CategoryLink
														params={params}
														id={null}
														label="All"
														active={!activeCategory}
													/>
												</li>
												{categories.map((c) => (
													<li key={c.id}>
														<CategoryLink
															params={params}
															id={c.id}
															label={c.name}
															count={c.count}
															active={activeCategory === c.id}
														/>
													</li>
												))}
											</ul>
										</div>
									) : null}

									<div className="facet">
										<h3>Price</h3>
										<div className="facet-range">
											<input
												type="number"
												name="min"
												min={0}
												step="0.01"
												placeholder={
													priceRange
														? `$${priceRange.minDollars.toFixed(0)}`
														: "Min"
												}
												defaultValue={params.get("min") ?? ""}
											/>
											<span className="muted">–</span>
											<input
												type="number"
												name="max"
												min={0}
												step="0.01"
												placeholder={
													priceRange
														? `$${priceRange.maxDollars.toFixed(0)}`
														: "Max"
												}
												defaultValue={params.get("max") ?? ""}
											/>
										</div>
									</div>

									<div className="facet">
										<h3>Minimum rating</h3>
										<select name="rating" defaultValue={activeRating ?? ""}>
											<option value="">Any rating</option>
											<option value="4">4★ & up</option>
											<option value="3">3★ & up</option>
											<option value="2">2★ & up</option>
											<option value="1">1★ & up</option>
										</select>
									</div>

									<div className="facet">
										<h3>Sort</h3>
										<select
											name="sort"
											defaultValue={params.get("sort") ?? "featured"}
										>
											{SORTS.map((s) => (
												<option value={s.value} key={s.value}>
													{s.label}
												</option>
											))}
										</select>
									</div>

									{/* Preserve the active category across an Apply submit. */}
									{activeCategory ? (
										<input type="hidden" name="category" value={activeCategory} />
									) : null}
									<button className="bd-btn" type="submit">
										Apply filters
									</button>
								</Form>
							</aside>

							{/* Product grid */}
							<div>
								{products.length === 0 ? (
									<p className="muted">No products match these filters.</p>
								) : (
									<div className="grid">
										{products.map((p) => (
											<Link
												className="card card--link"
												to={`/store/${p.id}`}
												key={p.id}
											>
												{p.image ? (
													<img className="card__img" src={p.image} alt={p.name} />
												) : null}
												{p.isBestSeller || p.isNew || p.isLowStock ? (
													<div className="card__badges">
														{p.isBestSeller ? (
															<span className="bd-badge">Best seller</span>
														) : null}
														{p.isNew ? (
															<span className="bd-badge">New</span>
														) : null}
														{p.isLowStock ? (
															<span className="bd-badge">Low stock</span>
														) : null}
													</div>
												) : null}
												<h3>{p.name}</h3>
												<div className="card__price-row">
													<span className="price">
														{p.fromPrice ? `From ${p.priceLabel}` : p.priceLabel}
													</span>
													{p.comparePriceLabel ? (
														<span className="price price--compare">
															{p.comparePriceLabel}
														</span>
													) : null}
												</div>
												{p.reviewCount > 0 ? (
													<span className="card__rating">
														<span className="stars">
															{"★".repeat(Math.round(p.avgRating))}
														</span>
														{p.avgRating.toFixed(1)} ({p.reviewCount})
													</span>
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
		</>
	);
}

/** Category link that preserves the other active facets in the query string. */
function CategoryLink({
	params,
	id,
	label,
	count,
	active,
}: {
	params: URLSearchParams;
	id: string | null;
	label: string;
	count?: number;
	active: boolean;
}) {
	const next = new URLSearchParams(params);
	if (id) next.set("category", id);
	else next.delete("category");
	const qs = next.toString();
	return (
		<Link
			to={qs ? `/store?${qs}` : "/store"}
			className={active ? "is-active" : undefined}
			prefetch="intent"
		>
			<span>{label}</span>
			{count != null ? <span className="count">{count}</span> : null}
		</Link>
	);
}
