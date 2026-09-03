import { useMemo, useState } from "react";

import { bd, money } from "../lib/bd";
import { Link } from "../lib/router";
import { ErrorBox, PageHead, useApi } from "./ui";

type Sort = "featured" | "newest" | "price-asc" | "price-desc" | "rating-desc";

const SORT_LABELS: Record<Sort, string> = {
	featured: "Featured",
	newest: "Newest",
	"price-asc": "Price: low to high",
	"price-desc": "Price: high to low",
	"rating-desc": "Top rated",
};

/** Five-star glyph row from an average rating (supports half stars). */
function Stars({ rating }: { rating: number }) {
	const full = Math.floor(rating);
	const half = rating - full >= 0.5;
	return (
		<span className="product-card__stars" aria-label={`${rating.toFixed(1)} out of 5`}>
			{[0, 1, 2, 3, 4].map((i) => (
				<span key={i}>{i < full ? "★" : i === full && half ? "⯨" : "☆"}</span>
			))}
		</span>
	);
}

export function Store() {
	const [search, setSearch] = useState("");
	const [categoryId, setCategoryId] = useState<string | null>(null);
	const [minRating, setMinRating] = useState<number | null>(null);
	const [minPrice, setMinPrice] = useState("");
	const [maxPrice, setMaxPrice] = useState("");
	const [sort, setSort] = useState<Sort>("featured");

	const minPriceCents = minPrice ? Math.round(Number(minPrice) * 100) : undefined;
	const maxPriceCents = maxPrice ? Math.round(Number(maxPrice) * 100) : undefined;

	const { data, error, loading } = useApi(
		() =>
			bd.storefront.listProductsWithMeta({
				limit: 48,
				...(search ? { search } : {}),
				...(categoryId ? { categoryId } : {}),
				...(minRating != null ? { minRating } : {}),
				...(minPriceCents != null ? { minPriceCents } : {}),
				...(maxPriceCents != null ? { maxPriceCents } : {}),
				sort,
			}),
		[search, categoryId, minRating, minPriceCents, maxPriceCents, sort],
	);
	// Categories load once for the sidebar (id → display name).
	const { data: catData } = useApi(() => bd.storefront.listCategories(), []);

	const items: Record<string, any>[] = data?.items ?? [];
	const categoryCounts: { categoryId: string; count: number }[] = data?.categoryCounts ?? [];
	const priceRange = data?.priceRange as { minDollars: number; maxDollars: number } | undefined;

	const categoryName = useMemo(() => {
		const m = new Map<string, string>();
		for (const c of (catData?.items ?? []) as { id: string; name: string }[]) m.set(c.id, c.name);
		return m;
	}, [catData]);

	const hasFilters = Boolean(
		search || categoryId || minRating != null || minPrice || maxPrice || sort !== "featured",
	);
	const clearFilters = () => {
		setSearch("");
		setCategoryId(null);
		setMinRating(null);
		setMinPrice("");
		setMaxPrice("");
		setSort("featured");
	};

	return (
		<main className="page">
			<PageHead title="Store" sub="Native storefront on the BD SDK." />
			<div className="store-layout">
				<aside className="store-sidebar">
					<div className="store-facet">
						<label className="bd-label" htmlFor="store-search">
							Search
						</label>
						<input
							className="bd-input"
							id="store-search"
							type="search"
							placeholder="Search products…"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
					</div>

					{categoryCounts.length > 0 ? (
						<div className="store-facet">
							<div className="store-facet__title">Categories</div>
							<ul className="store-facet__list">
								<li>
									<button
										type="button"
										className={`store-facet__opt${categoryId === null ? " is-active" : ""}`}
										onClick={() => setCategoryId(null)}
									>
										<span>All products</span>
									</button>
								</li>
								{categoryCounts.map((c) => (
									<li key={c.categoryId}>
										<button
											type="button"
											className={`store-facet__opt${categoryId === c.categoryId ? " is-active" : ""}`}
											onClick={() =>
												setCategoryId(categoryId === c.categoryId ? null : c.categoryId)
											}
										>
											<span>{categoryName.get(c.categoryId) ?? "Category"}</span>
											<span className="store-facet__count">{c.count}</span>
										</button>
									</li>
								))}
							</ul>
						</div>
					) : null}

					<div className="store-facet">
						<div className="store-facet__title">Price</div>
						<div className="store-facet__price">
							<input
								className="bd-input"
								type="number"
								min={0}
								inputMode="decimal"
								placeholder={priceRange ? `$${priceRange.minDollars}` : "Min"}
								value={minPrice}
								onChange={(e) => setMinPrice(e.target.value)}
								aria-label="Minimum price"
							/>
							<span className="store-facet__dash">—</span>
							<input
								className="bd-input"
								type="number"
								min={0}
								inputMode="decimal"
								placeholder={priceRange ? `$${priceRange.maxDollars}` : "Max"}
								value={maxPrice}
								onChange={(e) => setMaxPrice(e.target.value)}
								aria-label="Maximum price"
							/>
						</div>
					</div>

					<div className="store-facet">
						<div className="store-facet__title">Rating</div>
						<div className="store-facet__ratings">
							{[4, 3, 2, 1].map((r) => (
								<button
									key={r}
									type="button"
									className={`store-facet__opt${minRating === r ? " is-active" : ""}`}
									onClick={() => setMinRating(minRating === r ? null : r)}
								>
									<span className="product-card__stars">
										{"★".repeat(r)}
										{"☆".repeat(5 - r)}
									</span>
									<span>&amp; up</span>
								</button>
							))}
						</div>
					</div>

					{hasFilters ? (
						<button type="button" className="btn btn--ghost btn--sm" onClick={clearFilters}>
							Clear filters
						</button>
					) : null}
				</aside>

				<section className="store-results">
					<div className="store-results__bar">
						<span className="muted">
							{loading ? "Loading…" : `${items.length} product${items.length === 1 ? "" : "s"}`}
						</span>
						<label className="store-sort">
							<span className="muted">Sort</span>
							<select
								className="bd-select"
								value={sort}
								onChange={(e) => setSort(e.target.value as Sort)}
							>
								{(Object.keys(SORT_LABELS) as Sort[]).map((s) => (
									<option key={s} value={s}>
										{SORT_LABELS[s]}
									</option>
								))}
							</select>
						</label>
					</div>

					{error ? <ErrorBox error={error} /> : null}
					{data && items.length === 0 ? (
						<p className="bd-empty">
							{hasFilters
								? "No products match these filters."
								: "No products published yet."}
						</p>
					) : null}

					{items.length > 0 ? (
						<div className="product-grid">
							{items.map((p) => (
								<Link
									key={p.id}
									className="product-card"
									to={`/store/${encodeURIComponent(p.id)}`}
								>
									<div className="product-card__media">
										{p.coverImage ? (
											<img
												className="product-card__img"
												src={p.coverImage}
												alt={p.name}
												loading="lazy"
											/>
										) : (
											<div className="product-card__img product-card__img--ph" />
										)}
										<div className="product-card__badges">
											{p.isOnSale ? <span className="bd-badge badge--sale">Sale</span> : null}
											{p.isNew ? <span className="bd-badge">New</span> : null}
											{p.isBestSeller ? (
												<span className="bd-badge">Best seller</span>
											) : null}
											{p.isLowStock ? (
												<span className="bd-badge badge--low">Low stock</span>
											) : null}
										</div>
									</div>
									<div className="product-card__body">
										<div className="product-card__name">{p.name ?? "Product"}</div>
										{p.reviewCount > 0 ? (
											<div className="product-card__rating">
												<Stars rating={p.avgRating} />
												<span className="muted">({p.reviewCount})</span>
											</div>
										) : null}
										<div className="product-card__pricing">
											{p.cheapestPriceCents != null ? (
												<span className="product-card__price">
													{p.hasMultipleVariants ? "From " : ""}
													{money(p.cheapestPriceCents, p.currency)}
												</span>
											) : null}
											{p.isOnSale && p.comparePriceCents != null ? (
												<span className="product-card__compare">
													{money(p.comparePriceCents, p.currency)}
												</span>
											) : null}
										</div>
									</div>
								</Link>
							))}
						</div>
					) : null}
				</section>
			</div>
		</main>
	);
}
