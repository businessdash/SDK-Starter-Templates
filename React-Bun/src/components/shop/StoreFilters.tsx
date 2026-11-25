// [bd-file:store]
import type { FormEvent } from "react";
import { Link, useRoute, useSearchParams } from "../../lib/router";
import { StarRating } from "./StarRating";

/**
 * The store's filters and sort. Every filter is in the URL (?q, ?category,
 * ?min, ?max, ?rating, ?sort), so a filtered list can be shared and the
 * back button steps through filters. Each part reads the URL itself, so
 * they can go anywhere on the store page.
 */

export const SORTS = [
	{ value: "featured", label: "Featured" },
	{ value: "newest", label: "Newest" },
	{ value: "price-asc", label: "Price: low to high" },
	{ value: "price-desc", label: "Price: high to low" },
	{ value: "rating-desc", label: "Top rated" },
] as const;

export type Sort = (typeof SORTS)[number]["value"];

export function parseSort(raw: string | null): Sort {
	return SORTS.some((s) => s.value === raw) ? (raw as Sort) : "featured";
}

/** The ?rating filter: 1 to 5 stars, or undefined. */
export function parseRating(raw: string | null): number | undefined {
	const rating = Number.parseInt(raw ?? "", 10);
	return rating >= 1 && rating <= 5 ? rating : undefined;
}

/** True when the list is narrowed by any filter (sort isn't one). */
export function hasFilters(params: URLSearchParams): boolean {
	return ["q", "category", "min", "max", "rating"].some((key) => params.get(key));
}

function useStoreParams() {
	const { navigate } = useRoute();
	const params = useSearchParams();

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

	return { params, navigate, hrefWith, submitFilters };
}

/** Search products (?q). */
export function StoreSearch() {
	const { params, submitFilters } = useStoreParams();
	return (
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
	);
}

/** All products, then a link per category with how many products it has. */
export function CategoryFilter({ categories }: { categories: { id: string; name: string; count: number }[] }) {
	const { params, hrefWith } = useStoreParams();
	const categoryId = params.get("category") || undefined;
	if (categories.length === 0) return null;
	return (
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
	);
}

/** Lowest and highest price (?min, ?max, in dollars), with Apply. */
export function PriceFilter({ range }: { range: { minDollars: number; maxDollars: number } | undefined }) {
	const { params, submitFilters } = useStoreParams();
	return (
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
					placeholder={range ? `$${range.minDollars.toFixed(0)}` : "Min"}
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
					placeholder={range ? `$${range.maxDollars.toFixed(0)}` : "Max"}
				/>
			</div>
			<button className="bd-btn bd-btn--ghost store-price__apply" type="submit">
				Apply
			</button>
		</form>
	);
}

/** 4, 3 or 2 stars & up (?rating). */
export function RatingFilter() {
	const { params, hrefWith } = useStoreParams();
	const minRating = parseRating(params.get("rating"));
	return (
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
	);
}

/** "Clear all filters", while any filter is on. */
export function ClearFilters() {
	const { params } = useStoreParams();
	if (!hasFilters(params)) return null;
	return (
		<Link className="store-clear" keepScroll to="/store">
			Clear all filters
		</Link>
	);
}

/** The sort menu (?sort); it applies as soon as it changes. */
export function SortSelect() {
	const { params, navigate, hrefWith } = useStoreParams();
	const sort = parseSort(params.get("sort"));
	return (
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
	);
}
