import {
	ChangeDetectionStrategy,
	Component,
	OnInit,
	computed,
	inject,
	signal,
} from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import {
	biabApi,
	type CategoryCount,
	type ProductCard,
	type ProductCategory,
	type StoreFilters,
	type StoreSort,
} from "../lib/biab-api.client";

const SORT_OPTIONS: ReadonlyArray<{ value: StoreSort; label: string }> = [
	{ value: "featured", label: "Featured" },
	{ value: "newest", label: "Newest" },
	{ value: "price-asc", label: "Price: low to high" },
	{ value: "price-desc", label: "Price: high to low" },
	{ value: "rating-desc", label: "Top rated" },
];

/**
 * Storefront listing — platform-style shop page. Products + facets come from
 * the BIAB `listProductsWithMeta` surface via `/api/biab/store/products-meta`
 * (the API key stays server-side). The sidebar filters (search, categories +
 * counts, price range, min rating, sort) are reflected into the URL query
 * string so a filtered grid is shareable/back-button friendly. Cards carry
 * cover image, price/compare-at, star rating + count, and badges. "Add to
 * cart" posts through `/api/biab/cart/items`. Degrades to an empty/unconfigured
 * state gracefully.
 */
@Component({
	selector: "biab-store-page",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [RouterLink],
	template: `
		<section class="section store">
			<h1 class="section__title">Store</h1>

			@if (state() === "unavailable") {
				<p class="error">The store is temporarily unavailable. Please check back soon.</p>
			} @else {
				<div class="store__layout">
					<!-- ── Filter sidebar ────────────────────────────── -->
					<aside class="store-sidebar" aria-label="Product filters">
						<label class="store-sidebar__group">
							<span class="store-sidebar__label">Search</span>
							<input
								type="search"
								class="biab-input"
								placeholder="Search products…"
								[value]="search()"
								(input)="onSearch($any($event.target).value)"
							/>
						</label>

						<div class="store-sidebar__group">
							<span class="store-sidebar__label">Categories</span>
							<ul class="store-facets">
								<li>
									<button
										type="button"
										class="store-facet"
										[class.store-facet--active]="!categoryId()"
										(click)="setCategory(null)"
									>
										<span>All products</span>
									</button>
								</li>
								@for (c of categoriesWithCounts(); track c.id) {
									<li>
										<button
											type="button"
											class="store-facet"
											[class.store-facet--active]="categoryId() === c.id"
											(click)="setCategory(c.id)"
										>
											<span>{{ c.name }}</span>
											<span class="store-facet__count">{{ c.count }}</span>
										</button>
									</li>
								}
							</ul>
						</div>

						<div class="store-sidebar__group">
							<span class="store-sidebar__label">Price ($)</span>
							<div class="store-price">
								<input
									type="number"
									class="biab-input"
									min="0"
									inputmode="numeric"
									placeholder="Min"
									[value]="minPriceInput()"
									(change)="onMinPrice($any($event.target).value)"
									aria-label="Minimum price"
								/>
								<span class="muted">–</span>
								<input
									type="number"
									class="biab-input"
									min="0"
									inputmode="numeric"
									placeholder="Max"
									[value]="maxPriceInput()"
									(change)="onMaxPrice($any($event.target).value)"
									aria-label="Maximum price"
								/>
							</div>
						</div>

						<label class="store-sidebar__group">
							<span class="store-sidebar__label">Minimum rating</span>
							<select
								class="biab-input"
								[value]="minRatingValue()"
								(change)="onMinRating($any($event.target).value)"
							>
								<option value="0">Any rating</option>
								<option value="4">4★ &amp; up</option>
								<option value="3">3★ &amp; up</option>
								<option value="2">2★ &amp; up</option>
								<option value="1">1★ &amp; up</option>
							</select>
						</label>

						@if (hasActiveFilters()) {
							<button class="biab-btn biab-btn--ghost store-sidebar__clear" type="button" (click)="clearFilters()">
								Clear filters
							</button>
						}
					</aside>

					<!-- ── Results ────────────────────────────────────── -->
					<div class="store-results">
						<div class="store-results__bar">
							<span class="muted">
								@if (state() === "loading") {
									Loading…
								} @else {
									{{ products().length }} {{ products().length === 1 ? "product" : "products" }}
								}
							</span>
							<label class="store-sort">
								<span class="muted">Sort</span>
								<select class="biab-input" [value]="sort()" (change)="onSort($any($event.target).value)">
									@for (o of sortOptions; track o.value) {
										<option [value]="o.value">{{ o.label }}</option>
									}
								</select>
							</label>
						</div>

						@if (state() === "loading" && products().length === 0) {
							<p class="muted">Loading products…</p>
						} @else if (products().length === 0) {
							@if (hasActiveFilters()) {
								<p class="muted">No products match these filters. <button class="link-btn" type="button" (click)="clearFilters()">Clear filters</button>.</p>
							} @else {
								<p class="muted">No products yet — add them in BIAB (Products) and they appear here.</p>
							}
						} @else {
							<div class="grid store-grid">
								@for (p of products(); track p.id) {
									<article class="card product-card">
										<a class="product-card__media" [routerLink]="['/store', p.id]">
											@if (p.coverImage) {
												<img class="card__img" [src]="p.coverImage" [alt]="p.name" />
											} @else {
												<span class="product-card__placeholder" aria-hidden="true"></span>
											}
											@if (badges(p).length > 0) {
												<span class="product-card__badges">
													@for (b of badges(p); track b.label) {
														<span class="product-badge" [class.product-badge--sale]="b.kind === 'sale'">{{ b.label }}</span>
													}
												</span>
											}
										</a>
										<h3>
											<a [routerLink]="['/store', p.id]">{{ p.name }}</a>
										</h3>

										@if (p.reviewCount > 0) {
											<p class="product-card__rating">
												<span class="review__stars">{{ stars(p.avgRating) }}</span>
												<span class="muted">{{ p.avgRating.toFixed(1) }} ({{ p.reviewCount }})</span>
											</p>
										}

										@if (p.cheapestPriceCents != null) {
											<p class="product-card__price">
												@if (p.hasMultipleVariants) {
													<span class="muted product-card__from">From</span>
												}
												<span class="price">{{ money(p.cheapestPriceCents) }}</span>
												@if (p.isOnSale && p.comparePriceCents != null) {
													<span class="product-card__compare">{{ money(p.comparePriceCents) }}</span>
												}
											</p>
										}

										<button
											class="biab-btn product-card__add"
											type="button"
											(click)="add(p.id)"
											[disabled]="adding() === p.id"
										>
											{{ adding() === p.id ? "Adding…" : "Add to cart" }}
										</button>
									</article>
								}
							</div>
						}
					</div>
				</div>
			}

			<p class="store-links">
				<a routerLink="/cart">View cart</a> · <a routerLink="/subscriptions">Subscriptions</a>
			</p>
		</section>
	`,
})
export class StorePage implements OnInit {
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);

	readonly sortOptions = SORT_OPTIONS;

	readonly products = signal<ProductCard[]>([]);
	readonly categories = signal<ProductCategory[]>([]);
	readonly categoryCounts = signal<CategoryCount[]>([]);
	readonly state = signal<"loading" | "ready" | "unavailable">("loading");
	readonly adding = signal<string | null>(null);

	// Filter state (mirrored from / written back to the URL query string).
	readonly search = signal("");
	readonly categoryId = signal<string | null>(null);
	readonly minPriceCents = signal<number | null>(null);
	readonly maxPriceCents = signal<number | null>(null);
	readonly minRating = signal<number>(0);
	readonly sort = signal<StoreSort>("featured");

	private searchDebounce: ReturnType<typeof setTimeout> | null = null;

	/** Category list joined with facet counts (counts come from the meta call). */
	readonly categoriesWithCounts = computed(() => {
		const counts = new Map(this.categoryCounts().map((c) => [c.categoryId, c.count]));
		return this.categories()
			.map((c) => ({ id: c.id, name: c.name, count: counts.get(c.id) ?? 0 }))
			.filter((c) => c.count > 0 || this.categoryId() === c.id);
	});

	readonly minPriceInput = computed(() =>
		this.minPriceCents() != null ? String(Math.round(this.minPriceCents()! / 100)) : "",
	);
	readonly maxPriceInput = computed(() =>
		this.maxPriceCents() != null ? String(Math.round(this.maxPriceCents()! / 100)) : "",
	);
	readonly minRatingValue = computed(() => String(this.minRating()));

	readonly hasActiveFilters = computed(
		() =>
			!!this.search() ||
			!!this.categoryId() ||
			this.minPriceCents() != null ||
			this.maxPriceCents() != null ||
			this.minRating() > 0 ||
			this.sort() !== "featured",
	);

	async ngOnInit() {
		this.readFiltersFromUrl();
		// Categories are facet-stable; load once alongside the first grid.
		const cats = await biabApi.categories();
		this.categories.set(cats?.items ?? []);
		await this.load();
	}

	/** Hydrate the filter signals from the current query params (deep-link safe). */
	private readFiltersFromUrl() {
		const qp = this.route.snapshot.queryParamMap;
		this.search.set(qp.get("search") ?? "");
		this.categoryId.set(qp.get("category"));
		const min = qp.get("minPrice");
		const max = qp.get("maxPrice");
		this.minPriceCents.set(min ? Math.round(Number(min) * 100) : null);
		this.maxPriceCents.set(max ? Math.round(Number(max) * 100) : null);
		this.minRating.set(qp.get("rating") ? Number(qp.get("rating")) : 0);
		const s = qp.get("sort") as StoreSort | null;
		this.sort.set(
			s && SORT_OPTIONS.some((o) => o.value === s) ? s : "featured",
		);
	}

	/** Write the active filters into the URL (replaceUrl — no history spam). */
	private syncUrl() {
		const params: Record<string, string | null> = {
			search: this.search() || null,
			category: this.categoryId(),
			minPrice: this.minPriceCents() != null ? String(this.minPriceCents()! / 100) : null,
			maxPrice: this.maxPriceCents() != null ? String(this.maxPriceCents()! / 100) : null,
			rating: this.minRating() > 0 ? String(this.minRating()) : null,
			sort: this.sort() !== "featured" ? this.sort() : null,
		};
		void this.router.navigate([], {
			relativeTo: this.route,
			queryParams: params,
			queryParamsHandling: "merge",
			replaceUrl: true,
		});
	}

	private currentFilters(): StoreFilters {
		return {
			limit: 24,
			...(this.search() ? { search: this.search() } : {}),
			...(this.categoryId() ? { categoryId: this.categoryId()! } : {}),
			...(this.minPriceCents() != null ? { minPriceCents: this.minPriceCents()! } : {}),
			...(this.maxPriceCents() != null ? { maxPriceCents: this.maxPriceCents()! } : {}),
			...(this.minRating() > 0 ? { minRating: this.minRating() } : {}),
			sort: this.sort(),
		};
	}

	private async load() {
		this.state.set("loading");
		const res = await biabApi.productsMeta(this.currentFilters());
		if (!res) {
			this.state.set("unavailable");
			return;
		}
		this.products.set(res.items);
		this.categoryCounts.set(res.categoryCounts);
		this.state.set("ready");
	}

	/** Re-query + reflect into the URL after any filter change. */
	private async apply() {
		this.syncUrl();
		await this.load();
	}

	onSearch(value: string) {
		this.search.set(value);
		if (this.searchDebounce) clearTimeout(this.searchDebounce);
		this.searchDebounce = setTimeout(() => void this.apply(), 300);
	}

	setCategory(id: string | null) {
		this.categoryId.set(id);
		void this.apply();
	}

	onMinPrice(value: string) {
		const n = value.trim() === "" ? null : Math.max(0, Math.round(Number(value) * 100));
		this.minPriceCents.set(Number.isFinite(n as number) ? n : null);
		void this.apply();
	}

	onMaxPrice(value: string) {
		const n = value.trim() === "" ? null : Math.max(0, Math.round(Number(value) * 100));
		this.maxPriceCents.set(Number.isFinite(n as number) ? n : null);
		void this.apply();
	}

	onMinRating(value: string) {
		this.minRating.set(Number(value) || 0);
		void this.apply();
	}

	onSort(value: string) {
		const s = SORT_OPTIONS.find((o) => o.value === value)?.value ?? "featured";
		this.sort.set(s);
		void this.apply();
	}

	clearFilters() {
		this.search.set("");
		this.categoryId.set(null);
		this.minPriceCents.set(null);
		this.maxPriceCents.set(null);
		this.minRating.set(0);
		this.sort.set("featured");
		void this.apply();
	}

	badges(p: ProductCard): Array<{ label: string; kind: "sale" | "tag" }> {
		const out: Array<{ label: string; kind: "sale" | "tag" }> = [];
		if (p.isBestSeller) out.push({ label: "Best seller", kind: "tag" });
		if (p.isNew) out.push({ label: "New", kind: "tag" });
		if (p.isOnSale) out.push({ label: "Sale", kind: "sale" });
		if (p.isLowStock) out.push({ label: "Low stock", kind: "tag" });
		return out;
	}

	money(cents: number): string {
		return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
	}

	stars(rating: number): string {
		const n = Math.max(0, Math.min(5, Math.round(rating)));
		return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);
	}

	async add(productId: string) {
		this.adding.set(productId);
		await biabApi.addToCart(productId, 1);
		this.adding.set(null);
	}
}
