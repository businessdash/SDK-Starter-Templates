// [bd-file:store]
import type { FormEvent } from "react";

import { StoreNav } from "../components/StoreNav";
import { CompareBar } from "../components/shop/CompareBar";
import { SaveButtons } from "../components/shop/SaveButtons";
import { StarRating } from "../components/shop/StarRating";
import { formatCents } from "../components/shop/shop";
import { bd } from "../lib/bd";
import { Link, useRoute, useSearchParams } from "../lib/router";
import { ErrorBox, useApi } from "./ui";

const SORTS = [
	{ value: "featured", label: "Featured" },
	{ value: "newest", label: "Newest" },
	{ value: "price-asc", label: "Price: low to high" },
	{ value: "price-desc", label: "Price: high to low" },
	{ value: "rating-desc", label: "Top rated" },
] as const;

type Sort = (typeof SORTS)[number]["value"];

type Card = {
	id: string;
	name: string;
	coverImage: string | null;
	cheapestPriceCents: number | null;
	comparePriceCents: number | null;
	hasMultipleVariants: boolean;
	avgRating: number;
	reviewCount: number;
	isBestSeller: boolean;
	isNew: boolean;
	isOnSale: boolean;
	isLowStock: boolean;
};

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
 * ?rating, ?sort), so a filtered list can be shared and the back button
 * steps through filters.
 */
export function Store() {
	const { navigate } = useRoute();
	const params = useSearchParams();
	const search = params.get("q")?.trim() || undefined;
	const categoryId = params.get("category") || undefined;
	const sort = parseSort(params.get("sort"));
	const minPriceCents = parseCents(params.get("min"));
	const maxPriceCents = parseCents(params.get("max"));
	const ratingRaw = Number.parseInt(params.get("rating") ?? "", 10);
	const minRating = ratingRaw >= 1 && ratingRaw <= 5 ? ratingRaw : undefined;
	const hasFilters = ["q", "category", "min", "max", "rating"].some((key) => params.get(key));

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

	const products: Card[] = data?.items ?? [];
	const counts = new Map<string, number>(
		((data?.categoryCounts ?? []) as { categoryId: string; count: number }[]).map((c) => [c.categoryId, c.count]),
	);
	const categories = ((catData?.items ?? []) as { id: string; name: string }[]).map((c) => ({
		id: c.id,
		name: c.name,
		count: counts.get(c.id) ?? 0,
	}));
	const priceRange = data?.priceRange as { minDollars: number; maxDollars: number } | undefined;

	/** This list with some filters changed (null removes one). */
	function hrefWith(changes: Record<string, string | null>): string {
		const next = new URLSearchParams(params);
		for (const [key, value] of Object.entries(changes)) {
			if (value === null || value === "") next.delete(key);
			else next.set(key, value);
		}
		const qs = next.toString();
		return qs ? `/store?${qs}` : "/store";
	}

	/** A filter form: its fields replace those filters in the URL. */
	function submitFilters(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const changes: Record<string, string | null> = {};
		for (const [key, value] of new FormData(e.currentTarget)) changes[key] = String(value).trim() || null;
		navigate(hrefWith(changes), { scroll: false });
	}

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
							<form onSubmit={submitFilters}>
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
							</form>

							{categories.length > 0 ? (
								<div className="store-facet">
									<p className="store-facet__title">Category</p>
									<ul className="store-facet__list">
										<li>
											<Link
												className={`store-facet__item${categoryId ? "" : " store-facet__item--active"}`}
												keepScroll
												to={hrefWith({ category: null })}
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
														keepScroll
														to={hrefWith({ category: active ? null : c.id })}
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

							<form className="store-facet" onSubmit={submitFilters}>
								<p className="store-facet__title">Price</p>
								<div className="store-price">
									<input
										aria-label="Lowest price"
										className="bd-input"
										defaultValue={params.get("min") ?? ""}
										inputMode="decimal"
										key={`min${params.get("min") ?? ""}`}
										name="min"
										placeholder={priceRange ? `$${priceRange.minDollars.toFixed(0)}` : "Min"}
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
										placeholder={priceRange ? `$${priceRange.maxDollars.toFixed(0)}` : "Max"}
									/>
								</div>
								<button className="bd-btn bd-btn--ghost store-price__apply" type="submit">
									Apply
								</button>
							</form>

							<div className="store-facet">
								<p className="store-facet__title">Rating</p>
								<ul className="store-facet__list">
									{[4, 3, 2].map((r) => {
										const active = minRating === r;
										return (
											<li key={r}>
												<Link
													className={`store-facet__item store-facet__rating${active ? " store-facet__item--active" : ""}`}
													keepScroll
													to={hrefWith({ rating: active ? null : String(r) })}
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
								<Link className="store-clear" keepScroll to="/store">
									Clear all filters
								</Link>
							) : null}
						</aside>

						<div className="store-results">
							<div className="store-results__bar">
								<p className="bd-loading">
									{loading && !data
										? "Loading products…"
										: `${products.length} ${products.length === 1 ? "product" : "products"}`}
								</p>
								<label className="store-sort">
									<span>Sort</span>
									<select
										className="bd-select"
										onChange={(e) =>
											navigate(hrefWith({ sort: e.currentTarget.value === "featured" ? null : e.currentTarget.value }), {
												scroll: false,
											})
										}
										value={sort}
									>
										{SORTS.map((s) => (
											<option key={s.value} value={s.value}>
												{s.label}
											</option>
										))}
									</select>
								</label>
							</div>

							{!data ? null : products.length === 0 ? (
								<div className="bd-empty">
									{hasFilters
										? "No products match these filters. Try clearing a filter or broadening your search."
										: "No live products yet. Add and publish products in the BD dashboard and they'll appear here."}
								</div>
							) : (
								<div className="bd-grid-3">
									{products.map((p) => (
										<div className="bd-card product-card" key={p.id}>
											<Link className="product-card__link" to={`/store/${p.id}`}>
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
														{p.isBestSeller ? <span className="bd-badge">Best seller</span> : null}
														{p.isNew ? <span className="bd-badge">New</span> : null}
														{p.isOnSale ? <span className="bd-badge product-card__badge--sale">Sale</span> : null}
													</div>
												</div>
												<div className="product-card__body">
													<h3>{p.name || "Untitled"}</h3>
													{p.reviewCount > 0 ? (
														<div className="product-card__rating">
															<StarRating rating={p.avgRating} />
															<span className="product-card__count">({p.reviewCount})</span>
														</div>
													) : null}
													<div className="product-card__price">
														<span className="product-card__amount">
															{p.cheapestPriceCents != null
																? `${p.hasMultipleVariants ? "From " : ""}${formatCents(p.cheapestPriceCents)}`
																: "View details"}
														</span>
														{p.isOnSale && p.comparePriceCents != null ? (
															<span className="product-card__compare">{formatCents(p.comparePriceCents)}</span>
														) : null}
													</div>
													{p.isLowStock ? <span className="product-card__lowstock">Low stock</span> : null}
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
