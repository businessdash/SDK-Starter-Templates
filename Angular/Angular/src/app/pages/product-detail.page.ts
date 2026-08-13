import {
	ChangeDetectionStrategy,
	Component,
	OnInit,
	inject,
	signal,
} from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import {
	biabApi,
	type Product,
	type ProductAddon,
	type ProductReview,
	type ProductReviewsPayload,
	type RelatedProduct,
} from "../lib/biab-api.client";

/**
 * Product detail. Pulls a single product from `/api/biab/store/products/:id`
 * and offers "Add to cart". Enriched with approved reviews (avg + count), a
 * companion-addons rail, and a "you may also like" related grid — each pulled
 * from its own server endpoint and gracefully hidden when empty. Shows a
 * not-found state when the product isn't live or BIAB is unconfigured.
 */
@Component({
	selector: "biab-product-detail-page",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [RouterLink],
	template: `
		<section class="section">
			@if (state() === "loading") {
				<p class="muted">Loading…</p>
			} @else if (state() === "missing") {
				<h1 class="section__title">Product not found</h1>
				<p class="muted">It may be unavailable. <a routerLink="/store">Back to store</a>.</p>
			} @else if (product(); as p) {
				<a routerLink="/store" class="muted">← Store</a>
				<h1 class="section__title">{{ p.name }}</h1>

				@if (reviews(); as rv) {
					@if (rv.totalCount > 0) {
						<p class="product__rating-summary">
							<span class="review__stars">{{ stars(rv.avgRating) }}</span>
							<span class="muted">{{ rv.avgRating.toFixed(1) }} · {{ rv.totalCount }} {{ rv.totalCount === 1 ? "review" : "reviews" }}</span>
						</p>
					}
				}

				@if (firstImage(p); as img) {
					<img class="product__img" [src]="img" [alt]="p.name" />
				}
				@if (description(p); as d) {
					<p>{{ d }}</p>
				}
				<button class="biab-btn" type="button" (click)="add(p.id)" [disabled]="adding()">
					{{ adding() ? "Adding…" : "Add to cart" }}
				</button>

				<!-- ── Companion addons rail ──────────────────────────── -->
				@if (addons().length > 0) {
					<h2 class="section__subtitle">Complete your purchase</h2>
					<div class="grid addon-rail">
						@for (a of addons(); track a.id) {
							<article class="card addon-card">
								@if (a.imageUrl) {
									<img class="card__img" [src]="a.imageUrl" [alt]="a.addonName" />
								}
								<h3>{{ a.addonName }}</h3>
								@if (a.addonDescription) {
									<p>{{ a.addonDescription }}</p>
								}
								@if (a.priceCents != null) {
									<p class="addon-card__price">
										<span class="price">{{ money(a.priceCents) }}</span>
										@if (a.originalPriceCents != null && a.originalPriceCents > a.priceCents) {
											<span class="product-card__compare">{{ money(a.originalPriceCents) }}</span>
										}
									</p>
								}
								<button
									class="biab-btn biab-btn--ghost addon-card__add"
									type="button"
									(click)="add(a.addonProductId)"
									[disabled]="adding()"
								>
									Add
								</button>
							</article>
						}
					</div>
				}

				<!-- ── Reviews list ───────────────────────────────────── -->
				@if (reviewItems().length > 0) {
					<h2 class="section__subtitle">Reviews</h2>
					<ul class="review-list">
						@for (r of reviewItems(); track r.id) {
							<li class="review">
								<div class="review__head">
									<strong>{{ r.reviewerName || "Verified buyer" }}</strong>
									<span class="review__stars">{{ stars(r.rating) }}</span>
								</div>
								@if (r.title) {
									<p class="review__title"><strong>{{ r.title }}</strong></p>
								}
								@if (reviewBody(r); as body) {
									<p>{{ body }}</p>
								}
							</li>
						}
					</ul>
				}

				<!-- ── You may also like ──────────────────────────────── -->
				@if (related().length > 0) {
					<h2 class="section__subtitle">You may also like</h2>
					<div class="grid store-grid">
						@for (r of related(); track r.id) {
							<article class="card product-card">
								<a class="product-card__media" [routerLink]="['/store', r.id]">
									@if (r.coverImageUrl) {
										<img class="card__img" [src]="r.coverImageUrl" [alt]="r.name" />
									} @else {
										<span class="product-card__placeholder" aria-hidden="true"></span>
									}
								</a>
								<h3><a [routerLink]="['/store', r.id]">{{ r.name }}</a></h3>
								@if (r.minPriceDollars != null) {
									<p class="product-card__price">
										<span class="muted product-card__from">From</span>
										<span class="price">{{ dollars(r.minPriceDollars) }}</span>
									</p>
								}
							</article>
						}
					</div>
				}

				<p class="store-links"><a routerLink="/cart">View cart</a></p>
			}
		</section>
	`,
})
export class ProductDetailPage implements OnInit {
	private readonly route = inject(ActivatedRoute);
	readonly product = signal<Product | null>(null);
	readonly state = signal<"loading" | "ready" | "missing">("loading");
	readonly adding = signal(false);

	readonly reviews = signal<ProductReviewsPayload | null>(null);
	readonly reviewItems = signal<ProductReview[]>([]);
	readonly addons = signal<ProductAddon[]>([]);
	readonly related = signal<RelatedProduct[]>([]);

	async ngOnInit() {
		const id = this.route.snapshot.paramMap.get("id");
		if (!id) {
			this.state.set("missing");
			return;
		}
		const p = await biabApi.product(id);
		if (!p) {
			this.state.set("missing");
			return;
		}
		this.product.set(p);
		this.state.set("ready");

		// Enrichment loads in parallel; each degrades to empty (and stays hidden)
		// independently, so a missing reviews/addons/related endpoint never blocks
		// the core product view.
		const [rv, ad, rel] = await Promise.all([
			biabApi.productReviews(id, 20),
			biabApi.productAddons(id),
			biabApi.relatedProducts(id, 6),
		]);
		if (rv) {
			this.reviews.set(rv);
			this.reviewItems.set(rv.items);
		}
		this.addons.set(ad?.items ?? []);
		this.related.set(rel?.items ?? []);
	}

	firstImage(p: Product): string | null {
		return Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null;
	}

	description(p: Product): string | null {
		const d = (p as Record<string, unknown>)["description"];
		return typeof d === "string" ? d : null;
	}

	reviewBody(r: ProductReview): string | null {
		return r.body || r.content || null;
	}

	money(cents: number): string {
		return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
	}

	dollars(amount: number): string {
		return amount.toLocaleString(undefined, { style: "currency", currency: "USD" });
	}

	stars(rating: number): string {
		const n = Math.max(0, Math.min(5, Math.round(rating)));
		return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);
	}

	async add(id: string) {
		this.adding.set(true);
		await biabApi.addToCart(id, 1);
		this.adding.set(false);
	}
}
