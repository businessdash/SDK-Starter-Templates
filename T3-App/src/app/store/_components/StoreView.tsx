"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useMemo } from "react";

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

/** Filled-star rating, e.g. "★★★★☆". Half-rounded to whole stars. */
function Stars({ rating }: { rating: number }) {
	const filled = Math.round(rating);
	return (
		<span
			aria-label={`${rating.toFixed(1)} out of 5`}
			className="store-stars"
			role="img"
		>
			{"★★★★★".slice(0, filled)}
			<span className="store-stars__empty">{"★★★★★".slice(filled)}</span>
		</span>
	);
}

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
		<div>
			<div className="bd-section__lead" style={{ textAlign: "left" }}>
				<span className="bd-section__eyebrow">Shop</span>
				<h1 className="bd-section__title">Products</h1>
				<p className="bd-section__sub" style={{ margin: 0 }}>
					Filterable grid + facets via{" "}
					<code className="bd-code">storefront.listProductsWithMeta()</code>
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
					{/* Sidebar facets */}
					<aside className="store-sidebar">
						<form onSubmit={onSearch}>
							<label className="bd-label" htmlFor="store-search">
								Search
							</label>
							<input
								className="bd-input"
								defaultValue={filters.search ?? ""}
								id="store-search"
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
											className={`store-facet__btn${filters.categoryId ? "" : " is-active"}`}
											onClick={() => setParam("category", null)}
											type="button"
										>
											<span>All products</span>
										</button>
									</li>
									{categories.map((c) => {
										const active = filters.categoryId === c.id;
										const count = countByCategory.get(c.id) ?? 0;
										return (
											<li key={c.id}>
												<button
													className={`store-facet__btn${active ? " is-active" : ""}`}
													onClick={() =>
														setParam("category", active ? null : c.id)
													}
													type="button"
												>
													<span>{c.name}</span>
													<span className="store-facet__count">{count}</span>
												</button>
											</li>
										);
									})}
								</ul>
							</div>
						) : null}

						<form className="store-facet" onSubmit={onPrice}>
							<p className="store-facet__title">Price</p>
							<div className="store-facet__price">
								<input
									className="bd-input"
									defaultValue={filters.minDollars ?? ""}
									inputMode="numeric"
									name="min"
									placeholder={`$${meta.priceRange.minDollars}`}
								/>
								<span aria-hidden>–</span>
								<input
									className="bd-input"
									defaultValue={filters.maxDollars ?? ""}
									inputMode="numeric"
									name="max"
									placeholder={`$${meta.priceRange.maxDollars}`}
								/>
							</div>
							<button className="bd-btn bd-btn--ghost" type="submit">
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
												className={`store-facet__btn${active ? " is-active" : ""}`}
												onClick={() =>
													setParam("rating", active ? null : String(r))
												}
												type="button"
											>
												<span>
													<Stars rating={r} /> &amp; up
												</span>
											</button>
										</li>
									);
								})}
							</ul>
						</div>

						{hasFilters ? (
							<button
								className="store-facet__clear"
								onClick={() => router.push(pathname, { scroll: false })}
								type="button"
							>
								Clear all filters
							</button>
						) : null}
					</aside>

					{/* Grid */}
					<div className="store-results">
						<div className="store-results__bar">
							<p className="bd-loading" style={{ fontStyle: "normal" }}>
								{meta.items.length} product
								{meta.items.length === 1 ? "" : "s"}
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
							<Notice
								body="No products match these filters. Try clearing a filter or broadening your search."
								title="Nothing here yet"
							/>
						) : (
							<div className="bd-grid-3">
								{meta.items.map((p) => (
									<Link
										className="bd-card store-card"
										href={`/store/${p.id}`}
										key={p.id}
									>
										<div className="store-card__media">
											{p.coverImage ? (
												// eslint-disable-next-line @next/next/no-img-element
												<img
													alt={p.name}
													loading="lazy"
													referrerPolicy="no-referrer"
													src={p.coverImage}
												/>
											) : (
												<span className="store-card__noimg">No image</span>
											)}
											<div className="store-card__badges">
												{p.isBestSeller ? (
													<span className="bd-badge">Best seller</span>
												) : null}
												{p.isNew ? <span className="bd-badge">New</span> : null}
												{p.isOnSale ? (
													<span className="bd-badge store-badge--sale">
														Sale
													</span>
												) : null}
											</div>
										</div>
										<div className="store-card__body">
											<div className="store-card__head">
												<h3>{p.name}</h3>
											</div>
											{p.reviewCount > 0 ? (
												<div className="store-card__rating">
													<Stars rating={p.avgRating} />
													<span className="store-card__reviews">
														({p.reviewCount})
													</span>
												</div>
											) : null}
											<div className="store-card__pricing">
												<span className="store-card__price">
													{p.hasMultipleVariants ? "From " : ""}
													{priceLabel(p.cheapestPriceCents)}
												</span>
												{p.isOnSale && p.comparePriceCents != null ? (
													<span className="store-card__compare">
														{priceLabel(p.comparePriceCents)}
													</span>
												) : null}
											</div>
											{p.isLowStock ? (
												<span className="store-card__lowstock">Low stock</span>
											) : null}
										</div>
									</Link>
								))}
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
