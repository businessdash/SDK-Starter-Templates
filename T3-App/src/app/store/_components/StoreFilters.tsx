// [bd-file:store]
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FormEvent } from "react";

import { StarRating } from "@/app/_components/bd/shop/StarRating";

import type { StoreSort } from "./StoreView";

/**
 * The store's filters and sort. Every filter is in the URL (?q, ?category,
 * ?price, ?rating, ?sort), so a filtered list can be shared; the page
 * reads them on the server and passes each part what's chosen now.
 */

export const SORT_LABELS: Record<StoreSort, string> = {
	featured: "Featured",
	newest: "Newest",
	"price-asc": "Price: low to high",
	"price-desc": "Price: high to low",
	"rating-desc": "Top rated",
};

/** Set (or, with null, remove) one filter in the URL, keeping the scroll. */
function useSetParam() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	return (key: string, value: string | null) => {
		const params = new URLSearchParams(searchParams.toString());
		if (value === null || value === "") params.delete(key);
		else params.set(key, value);
		const qs = params.toString();
		router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
	};
}

/** Search products (?q). */
export function StoreSearch({ search }: { search: string | undefined }) {
	const setParam = useSetParam();
	const onSearch = (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
		setParam("q", q || null);
	};
	return (
		<form onSubmit={onSearch}>
			<label className="bd-label" htmlFor="store-search">
				Search
			</label>
			<input
				autoComplete="off"
				className="bd-input"
				defaultValue={search ?? ""}
				id="store-search"
				key={search ?? ""}
				name="q"
				placeholder="Search products…"
				type="search"
			/>
		</form>
	);
}

/** All products, then a button per category with how many products it has. */
export function CategoryFilter({
	categories,
	counts,
	categoryId,
}: {
	categories: Array<{ id: string; name: string }>;
	/** Products per category id. */
	counts: Map<string, number>;
	categoryId: string | undefined;
}) {
	const setParam = useSetParam();
	if (categories.length === 0) return null;
	return (
		<div className="store-facet">
			<p className="store-facet__title">Category</p>
			<ul className="store-facet__list">
				<li>
					<button
						className={`store-facet__item${categoryId ? "" : " store-facet__item--active"}`}
						onClick={() => setParam("category", null)}
						type="button"
					>
						All products
					</button>
				</li>
				{categories.map((c) => {
					const active = categoryId === c.id;
					return (
						<li key={c.id}>
							<button
								className={`store-facet__item store-facet__item--row${active ? " store-facet__item--active" : ""}`}
								onClick={() => setParam("category", active ? null : c.id)}
								type="button"
							>
								<span>{c.name}</span>
								<span className="store-facet__count">
									{counts.get(c.id) ?? 0}
								</span>
							</button>
						</li>
					);
				})}
			</ul>
		</div>
	);
}

/** Lowest and highest price (?price=min-max, in dollars), with Apply. */
export function PriceFilter({
	range,
	minDollars,
	maxDollars,
}: {
	/** The store's cheapest and dearest, shown as placeholders. */
	range: { minDollars: number; maxDollars: number };
	minDollars: number | undefined;
	maxDollars: number | undefined;
}) {
	const setParam = useSetParam();
	const onPrice = (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const fd = new FormData(e.currentTarget);
		const min = String(fd.get("min") ?? "").trim();
		const max = String(fd.get("max") ?? "").trim();
		setParam("price", min || max ? `${min || ""}-${max || ""}` : null);
	};
	return (
		<form className="store-facet" onSubmit={onPrice}>
			<p className="store-facet__title">Price</p>
			<div className="store-price">
				<input
					aria-label="Lowest price"
					className="bd-input"
					defaultValue={minDollars ?? ""}
					inputMode="numeric"
					key={`min${minDollars ?? ""}`}
					name="min"
					placeholder={`$${range.minDollars}`}
				/>
				<span aria-hidden="true" className="store-price__sep">
					–
				</span>
				<input
					aria-label="Highest price"
					className="bd-input"
					defaultValue={maxDollars ?? ""}
					inputMode="numeric"
					key={`max${maxDollars ?? ""}`}
					name="max"
					placeholder={`$${range.maxDollars}`}
				/>
			</div>
			<button className="bd-btn bd-btn--ghost store-price__apply" type="submit">
				Apply
			</button>
		</form>
	);
}

/** 4, 3 or 2 stars & up (?rating). */
export function RatingFilter({ minRating }: { minRating: number | undefined }) {
	const setParam = useSetParam();
	return (
		<div className="store-facet">
			<p className="store-facet__title">Rating</p>
			<ul className="store-facet__list">
				{[4, 3, 2].map((r) => {
					const active = minRating === r;
					return (
						<li key={r}>
							<button
								className={`store-facet__item store-facet__rating${active ? " store-facet__item--active" : ""}`}
								onClick={() => setParam("rating", active ? null : String(r))}
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
	);
}

/** "Clear all filters", while any filter is on. */
export function ClearFilters({ active }: { active: boolean }) {
	const router = useRouter();
	const pathname = usePathname();
	if (!active) return null;
	return (
		<button
			className="store-clear"
			onClick={() => router.push(pathname, { scroll: false })}
			type="button"
		>
			Clear all filters
		</button>
	);
}

/** The sort menu (?sort); it applies as soon as it changes. */
export function SortSelect({ sort }: { sort: StoreSort | undefined }) {
	const setParam = useSetParam();
	return (
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
				value={sort ?? "featured"}
			>
				{(Object.keys(SORT_LABELS) as StoreSort[]).map((s) => (
					<option key={s} value={s}>
						{SORT_LABELS[s]}
					</option>
				))}
			</select>
		</label>
	);
}
