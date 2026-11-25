// [bd-file:store]
import { Form, Link, useLoaderData, useSearchParams } from "react-router";
import type {
	LinksFunction,
	LoaderFunctionArgs,
	MetaFunction,
} from "react-router";

import shopStyles from "~/bd-shop.css?url";
import { SiteHeader } from "~/components/SiteHeader";
import { StoreNav } from "~/components/StoreNav";
import { CompareBar } from "~/components/shop/CompareBar";
import { SaveButtons } from "~/components/shop/SaveButtons";
import { StarRating } from "~/components/shop/StarRating";
import { formatCents } from "~/lib/format";
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

export default function StoreIndex() {
	const { connected, products, categories, priceRange, cartCount } =
		useLoaderData<typeof loader>();
	const [params] = useSearchParams();
	const categoryId = params.get("category");
	const rating = params.get("rating");
	const sort = params.get("sort") ?? "featured";
	const hasFilters = ["q", "category", "min", "max", "rating"].some((key) =>
		params.get(key),
	);

	/** This list with one filter changed (null removes it). */
	function hrefWith(key: string, value: string | null): string {
		const next = new URLSearchParams(params);
		if (value === null) next.delete(key);
		else next.set(key, value);
		const qs = next.toString();
		return qs ? `/store?${qs}` : "/store";
	}

	/** Hidden copies of the other filters, so a form keeps them. */
	function keep(...skip: string[]) {
		return [...params.entries()]
			.filter(([key]) => !skip.includes(key))
			.map(([key, value]) => (
				<input key={key} name={key} type="hidden" value={value} />
			));
	}

	return (
		<>
			<SiteHeader />
			<StoreNav cartCount={cartCount} />
			<main className="bd-page">
				<div className="bd-section__lead">
					<span className="bd-section__eyebrow">Shop</span>
					<h1 className="bd-section__title">Products</h1>
					<p className="bd-section__sub">
						Filter, sort, and open a product to choose its options and add it
						to your cart.
					</p>
				</div>

				{!connected ? (
					<div className="bd-empty">
						Store isn't connected yet. Add your BD env to list products.
					</div>
				) : (
					<div className="store-layout">
						<aside className="store-sidebar">
							<Form method="get" preventScrollReset>
								<label className="bd-label" htmlFor="store-search">
									Search
								</label>
								<input
									autoComplete="off"
									className="bd-input"
									defaultValue={params.get("q") ?? ""}
									id="store-search"
									key={params.get("q") ?? ""}
									name="q"
									placeholder="Search products…"
									type="search"
								/>
								{keep("q")}
							</Form>

							{categories.length > 0 ? (
								<div className="store-facet">
									<p className="store-facet__title">Category</p>
									<ul className="store-facet__list">
										<li>
											<Link
												className={`store-facet__item${categoryId ? "" : " store-facet__item--active"}`}
												preventScrollReset
												to={hrefWith("category", null)}
											>
												All products
											</Link>
										</li>
										{categories.map((c) => {
											const active = categoryId === c.id;
											return (
												<li key={c.id}>
													<Link
														className={`store-facet__item store-facet__item--row${active ? " store-facet__item--active" : ""}`}
														preventScrollReset
														prefetch="intent"
														to={hrefWith("category", active ? null : c.id)}
													>
														<span>{c.name}</span>
														<span className="store-facet__count">{c.count}</span>
													</Link>
												</li>
											);
										})}
									</ul>
								</div>
							) : null}

							<Form className="store-facet" method="get" preventScrollReset>
								<p className="store-facet__title">Price</p>
								<div className="store-price">
									<input
										aria-label="Lowest price"
										className="bd-input"
										defaultValue={params.get("min") ?? ""}
										inputMode="decimal"
										key={`min${params.get("min") ?? ""}`}
										name="min"
										placeholder={
											priceRange ? `$${priceRange.minDollars.toFixed(0)}` : "Min"
										}
									/>
									<span aria-hidden="true" className="store-price__sep">
										–
									</span>
									<input
										aria-label="Highest price"
										className="bd-input"
										defaultValue={params.get("max") ?? ""}
										inputMode="decimal"
										key={`max${params.get("max") ?? ""}`}
										name="max"
										placeholder={
											priceRange ? `$${priceRange.maxDollars.toFixed(0)}` : "Max"
										}
									/>
								</div>
								{keep("min", "max")}
								<button
									className="bd-btn bd-btn--ghost store-price__apply"
									type="submit"
								>
									Apply
								</button>
							</Form>

							<div className="store-facet">
								<p className="store-facet__title">Rating</p>
								<ul className="store-facet__list">
									{[4, 3, 2].map((r) => {
										const active = rating === String(r);
										return (
											<li key={r}>
												<Link
													className={`store-facet__item store-facet__rating${active ? " store-facet__item--active" : ""}`}
													preventScrollReset
													to={hrefWith("rating", active ? null : String(r))}
												>
													<StarRating rating={r} />
													<span className="store-facet__count">&amp; up</span>
												</Link>
											</li>
										);
									})}
								</ul>
							</div>

							{hasFilters ? (
								<Link className="store-clear" preventScrollReset to="/store">
									Clear all filters
								</Link>
							) : null}
						</aside>

						<div className="store-results">
							<div className="store-results__bar">
								<p className="bd-loading">
									{products.length}{" "}
									{products.length === 1 ? "product" : "products"}
								</p>
								<Form method="get" preventScrollReset>
									{keep("sort")}
									<label className="store-sort">
										<span>Sort</span>
										<select
											className="bd-select"
											defaultValue={sort}
											key={sort}
											name="sort"
											onChange={(e) => e.currentTarget.form?.requestSubmit()}
										>
											{SORTS.map((s) => (
												<option key={s.value} value={s.value}>
													{s.label}
												</option>
											))}
										</select>
									</label>
									<noscript>
										<button className="bd-btn bd-btn--ghost" type="submit">
											Sort
										</button>
									</noscript>
								</Form>
							</div>

							{products.length === 0 ? (
								<div className="bd-empty">
									{hasFilters
										? "No products match these filters. Try clearing a filter or broadening your search."
										: "No live products yet. Add and publish products in the BD dashboard and they'll appear here."}
								</div>
							) : (
								<div className="bd-grid-3">
									{products.map((p) => (
										<div className="bd-card product-card" key={p.id}>
											<Link
												className="product-card__link"
												prefetch="intent"
												to={`/store/${p.id}`}
											>
												<div className="product-card__media">
													{p.coverImage ? (
														<img
															alt={p.name}
															className="product-card__img"
															loading="lazy"
															referrerPolicy="no-referrer"
															src={p.coverImage}
														/>
													) : (
														<div className="product-card__noimg">No image</div>
													)}
													<div className="product-card__badges">
														{p.isBestSeller ? (
															<span className="bd-badge">Best seller</span>
														) : null}
														{p.isNew ? <span className="bd-badge">New</span> : null}
														{p.isOnSale ? (
															<span className="bd-badge product-card__badge--sale">
																Sale
															</span>
														) : null}
													</div>
												</div>
												<div className="product-card__body">
													<h3>{p.name || "Untitled"}</h3>
													{p.reviewCount > 0 ? (
														<div className="product-card__rating">
															<StarRating rating={p.avgRating} />
															<span className="product-card__count">
																({p.reviewCount})
															</span>
														</div>
													) : null}
													<div className="product-card__price">
														<span className="product-card__amount">
															{p.cheapestPriceCents != null
																? `${p.hasMultipleVariants ? "From " : ""}${formatCents(p.cheapestPriceCents)}`
																: "View details"}
														</span>
														{p.isOnSale && p.comparePriceCents != null ? (
															<span className="product-card__compare">
																{formatCents(p.comparePriceCents)}
															</span>
														) : null}
													</div>
													{p.isLowStock ? (
														<span className="product-card__lowstock">Low stock</span>
													) : null}
												</div>
											</Link>
											<div className="product-card__save">
												<SaveButtons
													compact
													product={{
														id: p.id,
														name: p.name,
														image: p.coverImage,
														priceCents: p.cheapestPriceCents,
													}}
												/>
											</div>
										</div>
									))}
								</div>
							)}
							<CompareBar />
						</div>
					</div>
				)}
			</main>
		</>
	);
}
