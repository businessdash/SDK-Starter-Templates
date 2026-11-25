// [bd-file:store]
import {
	ChangeDetectionStrategy,
	Component,
	CUSTOM_ELEMENTS_SCHEMA,
	DestroyRef,
	afterNextRender,
	computed,
	inject,
	signal,
} from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import {
	bdApi,
	type CategoryCount,
	type ProductCard,
	type ProductCategory,
	type StoreFilters,
	type StoreSort,
} from "../lib/bd-api.client";
import { ProductGridComponent } from "../sections/shop/product-grid.component";
import { CategoryFilterComponent } from "../sections/shop/category-filter.component";
import { ClearFiltersComponent } from "../sections/shop/clear-filters.component";
import { PriceFilterComponent } from "../sections/shop/price-filter.component";
import { RatingFilterComponent } from "../sections/shop/rating-filter.component";
import { SORT_OPTIONS, SortSelectComponent } from "../sections/shop/sort-select.component";
import { StoreSearchComponent } from "../sections/shop/store-search.component";
import { StoreNavComponent } from "../sections/store-nav.component";

/** A price typed in dollars, as cents; null when blank or not a price. */
function cents(value: string): number | null {
	if (!value.trim()) return null;
	const amount = Number.parseFloat(value);
	return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}

/**
 * The product list. Products and facets come from `listProductsWithMeta`
 * through `/api/bd/store/products-meta` (the API key stays on the server).
 * Every filter (search, category, price, rating, sort) is in the URL, so a
 * filtered list can be shared and reloaded. The page is laid out from the
 * shop's parts (src/app/sections/shop/): the filters, and a product card per
 * product, which saves to the wishlist or the comparison; `<bd-compare-bar>`
 * shows the picks. Those elements come from src/app/shop/, loaded by the
 * store bar.
 */
@Component({
	selector: "bd-store-page",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		CategoryFilterComponent,
		ClearFiltersComponent,
		PriceFilterComponent,
		ProductGridComponent,
		RatingFilterComponent,
		SortSelectComponent,
		StoreNavComponent,
		StoreSearchComponent,
	],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	template: `
		<bd-store-nav />
		<div class="bd-page">
			<div class="bd-section__lead">
				<span class="bd-section__eyebrow">Shop</span>
				<h1 class="bd-section__title">Products</h1>
				<p class="bd-section__sub">
					Filter, sort, and open a product to choose its options and add it to your cart.
				</p>
			</div>

			@if (state() === "unavailable") {
				<div class="bd-empty">The store is temporarily unavailable. Please check back soon.</div>
			} @else {
				<div class="store-layout">
					<aside aria-label="Product filters" class="store-sidebar">
						<bd-store-search [value]="search()" (search)="setSearch($event)" />
						<bd-category-filter
							[categories]="categoriesWithCounts()"
							[selected]="categoryId()"
							(select)="setCategory($event)"
						/>
						<bd-price-filter [range]="priceRange()" [value]="priceText()" (apply)="applyPrice($event)" />
						<bd-rating-filter [selected]="minRating()" (select)="setRating($event)" />
						@if (hasFilters()) {
							<bd-clear-filters (clear)="clearFilters()" />
						}
					</aside>

					<div class="store-results">
						<div class="store-results__bar">
							<p class="bd-loading" aria-live="polite">
								@if (state() === "loading") {
									Loading products…
								} @else {
									{{ products().length }} {{ products().length === 1 ? "product" : "products" }}
								}
							</p>
							<bd-sort-select [value]="sort()" (sortChange)="setSort($event)" />
						</div>

						@if (state() === "ready" && products().length === 0) {
							<div class="bd-empty">
								@if (hasFilters()) {
									No products match these filters. Try clearing a filter or broadening your search.
								} @else {
									No live products yet. Add and publish products in the BD dashboard and they'll
									appear here.
								}
							</div>
						} @else {
							<bd-product-grid [products]="products()" />
						}
						<bd-compare-bar />
					</div>
				</div>
			}
		</div>
	`,
})
export class StorePage {
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);

	readonly products = signal<ProductCard[]>([]);
	readonly categories = signal<ProductCategory[]>([]);
	readonly categoryCounts = signal<CategoryCount[]>([]);
	readonly priceRange = signal<{ minDollars: number; maxDollars: number } | null>(null);
	readonly state = signal<"loading" | "ready" | "unavailable">("loading");

	// The filters, read from and written back to the URL.
	readonly search = signal("");
	readonly categoryId = signal<string | null>(null);
	readonly minPriceCents = signal<number | null>(null);
	readonly maxPriceCents = signal<number | null>(null);
	/** The prices as typed, for the price boxes. */
	readonly priceText = signal({ min: "", max: "" });
	readonly minRating = signal(0);
	readonly sort = signal<StoreSort>("featured");

	readonly hasFilters = computed(
		() =>
			this.search() !== "" ||
			this.categoryId() !== null ||
			this.minPriceCents() !== null ||
			this.maxPriceCents() !== null ||
			this.minRating() > 0,
	);

	/** The categories with their counts; empty ones drop out unless chosen. */
	readonly categoriesWithCounts = computed(() => {
		const counts = new Map(this.categoryCounts().map((c) => [c.categoryId, c.count]));
		return this.categories()
			.map((c) => ({ id: c.id, name: c.name, count: counts.get(c.id) ?? 0 }))
			.filter((c) => c.count > 0 || this.categoryId() === c.id);
	});

	constructor() {
		this.readFiltersFromUrl();
		// The list loads in the browser; the server renders the page around it.
		const destroyRef = inject(DestroyRef);
		afterNextRender(() => {
			void bdApi.categories().then((cats) => {
				if (!destroyRef.destroyed) this.categories.set(cats?.items ?? []);
			});
			void this.load();
		});
	}

	/** The filters from the query string, so a shared link opens the same list. */
	private readFiltersFromUrl() {
		const qp = this.route.snapshot.queryParamMap;
		this.search.set(qp.get("search") ?? "");
		this.categoryId.set(qp.get("category"));
		this.minPriceCents.set(cents(qp.get("minPrice") ?? ""));
		this.maxPriceCents.set(cents(qp.get("maxPrice") ?? ""));
		this.priceText.set({ min: qp.get("minPrice") ?? "", max: qp.get("maxPrice") ?? "" });
		const rating = Number(qp.get("rating"));
		this.minRating.set(rating >= 1 && rating <= 5 ? rating : 0);
		this.sort.set(SORT_OPTIONS.find((o) => o.value === qp.get("sort"))?.value ?? "featured");
	}

	/** The filters into the URL; replaceUrl keeps each keystroke out of history. */
	private syncUrl() {
		const min = this.minPriceCents();
		const max = this.maxPriceCents();
		void this.router.navigate([], {
			relativeTo: this.route,
			queryParams: {
				search: this.search() || null,
				category: this.categoryId(),
				minPrice: min != null ? String(min / 100) : null,
				maxPrice: max != null ? String(max / 100) : null,
				rating: this.minRating() > 0 ? String(this.minRating()) : null,
				sort: this.sort() !== "featured" ? this.sort() : null,
			},
			queryParamsHandling: "merge",
			replaceUrl: true,
		});
	}

	private currentFilters(): StoreFilters {
		const categoryId = this.categoryId();
		const min = this.minPriceCents();
		const max = this.maxPriceCents();
		return {
			limit: 48,
			sort: this.sort(),
			...(this.search() ? { search: this.search() } : {}),
			...(categoryId ? { categoryId } : {}),
			...(min != null ? { minPriceCents: min } : {}),
			...(max != null ? { maxPriceCents: max } : {}),
			...(this.minRating() > 0 ? { minRating: this.minRating() } : {}),
		};
	}

	private loadSeq = 0;

	private async load() {
		const seq = ++this.loadSeq;
		this.state.set("loading");
		const res = await bdApi.productsMeta(this.currentFilters());
		// A newer filter change has started its own load.
		if (seq !== this.loadSeq) return;
		if (!res) {
			this.state.set("unavailable");
			return;
		}
		this.products.set(res.items);
		this.categoryCounts.set(res.categoryCounts);
		this.priceRange.set(res.priceRange ?? null);
		this.state.set("ready");
	}

	private async apply() {
		this.syncUrl();
		await this.load();
	}

	setSearch(search: string) {
		this.search.set(search);
		void this.apply();
	}

	setCategory(id: string | null) {
		this.categoryId.set(id);
		void this.apply();
	}

	setRating(rating: number) {
		this.minRating.set(rating);
		void this.apply();
	}

	setSort(sort: StoreSort) {
		this.sort.set(sort);
		void this.apply();
	}

	applyPrice(typed: { min: string; max: string }) {
		this.priceText.set(typed);
		this.minPriceCents.set(cents(typed.min));
		this.maxPriceCents.set(cents(typed.max));
		void this.apply();
	}

	clearFilters() {
		this.search.set("");
		this.categoryId.set(null);
		this.minPriceCents.set(null);
		this.maxPriceCents.set(null);
		this.priceText.set({ min: "", max: "" });
		this.minRating.set(0);
		void this.apply();
	}
}
