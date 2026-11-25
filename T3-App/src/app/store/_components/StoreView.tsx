// [bd-file:store]
"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useMemo } from "react";

import { CompareBar } from "@/app/_components/bd/shop/CompareBar";
import { SaveButtons } from "@/app/_components/bd/shop/SaveButtons";
import { StarRating } from "@/app/_components/bd/shop/StarRating";

import { Notice } from "./Notice";

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

const SORT_LABELS: Record<StoreSort, string> = {
	featured: "Featured",
	newest: "Newest",
	"price-asc": "Price: low to high",
	"price-desc": "Price: high to low",
	"rating-desc": "Top rated",
};

function priceLabel(cents: number | null): string {
	if (cents == null) return "—";
	const dollars = cents / 100;
	try {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: dollars % 1 === 0 ? 0 : 2,
		}).format(dollars);
	} catch {
		return `$${dollars.toFixed(2)}`;
	}
}

/**
 * The product list: search, category, price and rating filters with a sort,
 * all in the URL (?q, ?category, ?price, ?rating, ?sort), so a filtered list
 * can be shared. Each card can be saved or added to the comparison.
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
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const countByCategory = useMemo(
		() => new Map(meta.categoryCounts.map((c) => [c.categoryId, c.count])),
		[meta.categoryCounts],
	);

	const setParam = (key: string, value: string | null) => {
		const params = new URLSearchParams(searchParams.toString());
		if (value === null || value === "") params.delete(key);
		else params.set(key, value);
		const qs = params.toString();
		router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
	};

	const hasFilters = Boolean(
		filters.search ||
			filters.categoryId ||
			filters.minRating ||
			filters.minDollars != null ||
			filters.maxDollars != null,
	);

	const onSearch = (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
		setParam("q", q || null);
	};
	const onPrice = (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const fd = new FormData(e.currentTarget);
		const min = String(fd.get("min") ?? "").trim();
		const max = String(fd.get("max") ?? "").trim();
		setParam("price", min || max ? `${min || ""}-${max || ""}` : null);
	};

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
						<form onSubmit={onSearch}>
							<label className="bd-label" htmlFor="store-search">
								Search
							</label>
							<input
								autoComplete="off"
								className="bd-input"
								defaultValue={filters.search ?? ""}
								id="store-search"
								key={filters.search ?? ""}
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
										<button
											className={`store-facet__item${filters.categoryId ? "" : " store-facet__item--active"}`}
											onClick={() => setParam("category", null)}
											type="button"
										>
											All products
										</button>
									</li>
									{categories.map((c) => {
										const active = filters.categoryId === c.id;
										return (
											<li key={c.id}>
												<button
													className={`store-facet__item store-facet__item--row${active ? " store-facet__item--active" : ""}`}
													onClick={() =>
														setParam("category", active ? null : c.id)
													}
													type="button"
												>
													<span>{c.name}</span>
													<span className="store-facet__count">
														{countByCategory.get(c.id) ?? 0}
													</span>
												</button>
											</li>
										);
									})}
								</ul>
							</div>
						) : null}

						<form className="store-facet" onSubmit={onPrice}>
							<p className="store-facet__title">Price</p>
							<div className="store-price">
								<input
									aria-label="Lowest price"
									className="bd-input"
									defaultValue={filters.minDollars ?? ""}
									inputMode="numeric"
									key={`min${filters.minDollars ?? ""}`}
									name="min"
									placeholder={`$${meta.priceRange.minDollars}`}
								/>
								<span aria-hidden="true" className="store-price__sep">
									–
								</span>
								<input
									aria-label="Highest price"
									className="bd-input"
									defaultValue={filters.maxDollars ?? ""}
									inputMode="numeric"
									key={`max${filters.maxDollars ?? ""}`}
									name="max"
									placeholder={`$${meta.priceRange.maxDollars}`}
								/>
							</div>
							<button
								className="bd-btn bd-btn--ghost store-price__apply"
								type="submit"
							>
								Apply
							</button>
						</form>

						<div className="store-facet">
							<p className="store-facet__title">Rating</p>
							<ul className="store-facet__list">
								{[4, 3, 2].map((r) => {
									const active = filters.minRating === r;
									return (
										<li key={r}>
											<button
												className={`store-facet__item store-facet__rating${active ? " store-facet__item--active" : ""}`}
												onClick={() =>
													setParam("rating", active ? null : String(r))
												}
												type="button"
											>
												<StarRating rating={r} />
												<span className="store-facet__count">&amp; up</span>
											</button>
										</li>
									);
								})}
							</ul>
						</div>

						{hasFilters ? (
							<button
								className="store-clear"
								onClick={() => router.push(pathname, { scroll: false })}
								type="button"
							>
								Clear all filters
							</button>
						) : null}
					</aside>

					<div className="store-results">
						<div className="store-results__bar">
							<p className="bd-loading">
								{meta.items.length}{" "}
								{meta.items.length === 1 ? "product" : "products"}
							</p>
							<label className="store-sort">
								<span>Sort</span>
								<select
									className="bd-select"
									onChange={(e) =>
										setParam(
											"sort",
											e.target.value === "featured" ? null : e.target.value,
										)
									}
									value={filters.sort ?? "featured"}
								>
									{(Object.keys(SORT_LABELS) as StoreSort[]).map((s) => (
										<option key={s} value={s}>
											{SORT_LABELS[s]}
										</option>
									))}
								</select>
							</label>
						</div>

						{meta.items.length === 0 ? (
							<div className="bd-empty">
								{hasFilters
									? "No products match these filters. Try clearing a filter or broadening your search."
									: "No live products yet. Add and publish products in the BD dashboard and they'll appear here."}
							</div>
						) : (
							<div className="bd-grid-3">
								{meta.items.map((p) => (
									<div className="bd-card product-card" key={p.id}>
										<Link
											className="product-card__link"
											href={`/store/${p.id}`}
										>
											<div className="product-card__media">
												{p.coverImage ? (
													// eslint-disable-next-line @next/next/no-img-element
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
													{p.isNew ? (
														<span className="bd-badge">New</span>
													) : null}
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
														{p.hasMultipleVariants ? "From " : ""}
														{priceLabel(p.cheapestPriceCents)}
													</span>
													{p.isOnSale && p.comparePriceCents != null ? (
														<span className="product-card__compare">
															{priceLabel(p.comparePriceCents)}
														</span>
													) : null}
												</div>
												{p.isLowStock ? (
													<span className="product-card__lowstock">
														Low stock
													</span>
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
		</>
	);
}
