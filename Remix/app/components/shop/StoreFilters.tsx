// [bd-file:store]
import { Form, Link, useSearchParams } from "react-router";
import { StarRating } from "./StarRating";

/**
 * The store's filters and sort. Every filter is in the URL (?q, ?category,
 * ?min, ?max, ?rating, ?sort): categories and ratings are links, and
 * search, price and sort are GET forms, so filtering works without
 * JavaScript and a filtered list can be shared. Each part reads the URL
 * itself, so they can go anywhere on the store page.
 */

export const SORTS = [
	{ value: "featured", label: "Featured" },
	{ value: "newest", label: "Newest" },
	{ value: "price-asc", label: "Price: low to high" },
	{ value: "price-desc", label: "Price: high to low" },
	{ value: "rating-desc", label: "Top rated" },
] as const;

/** The filters a list is narrowed by (sort isn't one). */
const FILTERS = ["q", "category", "min", "max", "rating"];

function useStoreParams() {
	const [params] = useSearchParams();
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
	return { params, hrefWith, keep };
}

/** True when the list is narrowed by any filter. */
export function useHasFilters(): boolean {
	const [params] = useSearchParams();
	return FILTERS.some((key) => params.get(key));
}

/** Search products (?q). */
export function StoreSearch() {
	const { params, keep } = useStoreParams();
	return (
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
	);
}

/** All products, then a link per category with how many products it has. */
export function CategoryFilter({
	categories,
}: {
	categories: { id: string; name: string; count: number }[];
}) {
	const { params, hrefWith } = useStoreParams();
	const categoryId = params.get("category");
	if (categories.length === 0) return null;
	return (
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
								prefetch="intent"
								preventScrollReset
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
	);
}

/** Lowest and highest price (?min, ?max, in dollars), with Apply. */
export function PriceFilter({
	range,
}: {
	/** The store's cheapest and dearest, shown as placeholders. */
	range: { minDollars: number; maxDollars: number } | null;
}) {
	const { params, keep } = useStoreParams();
	return (
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
			{keep("min", "max")}
			<button className="bd-btn bd-btn--ghost store-price__apply" type="submit">
				Apply
			</button>
		</Form>
	);
}

/** 4, 3 or 2 stars & up (?rating). */
export function RatingFilter() {
	const { params, hrefWith } = useStoreParams();
	const rating = params.get("rating");
	return (
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
	);
}

/** "Clear all filters", while any filter is on. */
export function ClearFilters() {
	if (!useHasFilters()) return null;
	return (
		<Link className="store-clear" preventScrollReset to="/store">
			Clear all filters
		</Link>
	);
}

/** The sort menu (?sort); it applies as soon as it changes. */
export function SortSelect() {
	const { params, keep } = useStoreParams();
	const sort = params.get("sort") ?? "featured";
	return (
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
	);
}
