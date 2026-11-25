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
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { debounceTime, distinctUntilChanged } from "rxjs";
import {
	bdApi,
	type CategoryCount,
	type ProductCard,
	type ProductCategory,
	type StoreFilters,
	type StoreSort,
} from "../lib/bd-api.client";
import { StarRatingComponent } from "../sections/star-rating.component";
import { StoreNavComponent } from "../sections/store-nav.component";

const SORT_OPTIONS: ReadonlyArray<{ value: StoreSort; label: string }> = [
	{ value: "featured", label: "Featured" },
	{ value: "newest", label: "Newest" },
	{ value: "price-asc", label: "Price: low to high" },
	{ value: "price-desc", label: "Price: high to low" },
	{ value: "rating-desc", label: "Top rated" },
];

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
 * filtered list can be shared and reloaded. Each card saves to the wishlist
 * or the comparison (`<bd-save-buttons>`); `<bd-compare-bar>` shows the
 * picks. Those elements come from src/app/shop/, loaded by the store bar.
 */
@Component({
	selector: "bd-store-page",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ReactiveFormsModule, RouterLink, StarRatingComponent, StoreNavComponent],
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
						<div role="search">
							<label class="bd-label" for="store-search">Search</label>
							<input
								autocomplete="off"
								class="bd-input"
								id="store-search"
								placeholder="Search products…"
								type="search"
								[formControl]="searchControl"
							/>
						</div>

						@if (categoriesWithCounts().length > 0) {
							<div class="store-facet">
								<p class="store-facet__title">Category</p>
								<ul class="store-facet__list">
									<li>
										<button
											class="store-facet__item"
											type="button"
											[attr.aria-pressed]="!categoryId()"
											[class.store-facet__item--active]="!categoryId()"
											(click)="setCategory(null)"
										>
											All products
										</button>
									</li>
									@for (c of categoriesWithCounts(); track c.id) {
										<li>
											<button
												class="store-facet__item store-facet__item--row"
												type="button"
												[attr.aria-pressed]="categoryId() === c.id"
												[class.store-facet__item--active]="categoryId() === c.id"
												(click)="setCategory(categoryId() === c.id ? null : c.id)"
											>
												<span>{{ c.name }}</span>
												<span class="store-facet__count">{{ c.count }}</span>
											</button>
										</li>
									}
								</ul>
							</div>
						}

						<form class="store-facet" [formGroup]="priceForm" (ngSubmit)="applyPrice()">
							<p class="store-facet__title">Price</p>
							<div class="store-price">
								<input
									aria-label="Lowest price"
									class="bd-input"
									formControlName="min"
									inputmode="decimal"
									[placeholder]="pricePlaceholder().min"
								/>
								<span aria-hidden="true" class="store-price__sep">–</span>
								<input
									aria-label="Highest price"
									class="bd-input"
									formControlName="max"
									inputmode="decimal"
									[placeholder]="pricePlaceholder().max"
								/>
							</div>
							<button class="bd-btn bd-btn--ghost store-price__apply" type="submit">Apply</button>
						</form>

						<div class="store-facet">
							<p class="store-facet__title">Rating</p>
							<ul class="store-facet__list">
								@for (r of ratingSteps; track r) {
									<li>
										<button
											class="store-facet__item store-facet__rating"
											type="button"
											[attr.aria-pressed]="minRating() === r"
											[class.store-facet__item--active]="minRating() === r"
											(click)="setRating(minRating() === r ? 0 : r)"
										>
											<bd-star-rating [rating]="r" />
											<span class="store-facet__count">&amp; up</span>
										</button>
									</li>
								}
							</ul>
						</div>

						@if (hasFilters()) {
							<button class="store-clear" type="button" (click)="clearFilters()">Clear all filters</button>
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
							<div class="store-sort">
								<label for="store-sort">Sort</label>
								<select class="bd-select" id="store-sort" [formControl]="sortControl">
									@for (o of sortOptions; track o.value) {
										<option [value]="o.value">{{ o.label }}</option>
									}
								</select>
							</div>
						</div>

						@if (state() === "ready" && cards().length === 0) {
							<div class="bd-empty">
								@if (hasFilters()) {
									No products match these filters. Try clearing a filter or broadening your search.
								} @else {
									No live products yet. Add and publish products in the BD dashboard and they'll
									appear here.
								}
							</div>
						} @else {
							<div class="bd-grid-3">
								@for (p of cards(); track p.id) {
									<div class="bd-card product-card">
										<a class="product-card__link" [routerLink]="['/store', p.id]">
											<div class="product-card__media">
												@if (p.coverImage) {
													<img
														class="product-card__img"
														loading="lazy"
														referrerpolicy="no-referrer"
														[alt]="p.name"
														[src]="p.coverImage"
													/>
												} @else {
													<div class="product-card__noimg">No image</div>
												}
												<div class="product-card__badges">
													@if (p.isBestSeller) {
														<span class="bd-badge">Best seller</span>
													}
													@if (p.isNew) {
														<span class="bd-badge">New</span>
													}
													@if (p.isOnSale) {
														<span class="bd-badge product-card__badge--sale">Sale</span>
													}
												</div>
											</div>
											<div class="product-card__body">
												<h3>{{ p.name || "Untitled" }}</h3>
												@if (p.reviewCount > 0) {
													<div class="product-card__rating">
														<bd-star-rating [rating]="p.avgRating" />
														<span class="product-card__count">({{ p.reviewCount }})</span>
													</div>
												}
												<div class="product-card__price">
													<span class="product-card__amount">{{ p.priceLabel }}</span>
													@if (p.isOnSale && p.comparePriceCents != null) {
														<span class="product-card__compare">{{ money(p.comparePriceCents) }}</span>
													}
												</div>
												@if (p.isLowStock) {
													<span class="product-card__lowstock">Low stock</span>
												}
											</div>
										</a>
										<div class="product-card__save">
											<bd-save-buttons compact [attr.data-product]="p.saved" />
										</div>
									</div>
								}
							</div>
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

	readonly sortOptions = SORT_OPTIONS;
	readonly ratingSteps = [4, 3, 2];

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
	readonly minRating = signal(0);
	readonly sort = signal<StoreSort>("featured");

	readonly searchControl = new FormControl("", { nonNullable: true });
	readonly sortControl = new FormControl<StoreSort>("featured", { nonNullable: true });
	readonly priceForm = new FormGroup({
		min: new FormControl("", { nonNullable: true }),
		max: new FormControl("", { nonNullable: true }),
	});

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

	readonly pricePlaceholder = computed(() => {
		const range = this.priceRange();
		return range
			? { min: `$${Math.floor(range.minDollars)}`, max: `$${Math.ceil(range.maxDollars)}` }
			: { min: "Min", max: "Max" };
	});

	/** The cards with their price line and what ♡ Save and Compare keep. */
	readonly cards = computed(() =>
		this.products().map((p) => ({
			...p,
			priceLabel:
				p.cheapestPriceCents != null
					? `${p.hasMultipleVariants ? "From " : ""}${this.money(p.cheapestPriceCents)}`
					: "View details",
			saved: JSON.stringify({
				id: p.id,
				name: p.name,
				image: p.coverImage ?? null,
				priceCents: p.cheapestPriceCents ?? null,
			}),
		})),
	);

	constructor() {
		this.readFiltersFromUrl();
		this.searchControl.valueChanges
			.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
			.subscribe((value) => {
				this.search.set(value.trim());
				void this.apply();
			});
		this.sortControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
			this.sort.set(value);
			void this.apply();
		});
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
		const rating = Number(qp.get("rating"));
		this.minRating.set(rating >= 1 && rating <= 5 ? rating : 0);
		const sort = SORT_OPTIONS.find((o) => o.value === qp.get("sort"))?.value ?? "featured";
		this.sort.set(sort);
		this.searchControl.setValue(this.search(), { emitEvent: false });
		this.sortControl.setValue(sort, { emitEvent: false });
		this.priceForm.setValue(
			{ min: qp.get("minPrice") ?? "", max: qp.get("maxPrice") ?? "" },
			{ emitEvent: false },
		);
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

	setCategory(id: string | null) {
		this.categoryId.set(id);
		void this.apply();
	}

	setRating(rating: number) {
		this.minRating.set(rating);
		void this.apply();
	}

	applyPrice() {
		const { min, max } = this.priceForm.getRawValue();
		this.minPriceCents.set(cents(min));
		this.maxPriceCents.set(cents(max));
		void this.apply();
	}

	clearFilters() {
		this.search.set("");
		this.categoryId.set(null);
		this.minPriceCents.set(null);
		this.maxPriceCents.set(null);
		this.minRating.set(0);
		this.searchControl.setValue("", { emitEvent: false });
		this.priceForm.setValue({ min: "", max: "" }, { emitEvent: false });
		void this.apply();
	}

	/** Product prices are cents. */
	money(cents: number): string {
		return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
	}
}
