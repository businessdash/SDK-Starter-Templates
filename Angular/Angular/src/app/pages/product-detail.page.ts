// [bd-file:store]
import { ChangeDetectionStrategy, Component, PLATFORM_ID, inject, signal } from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Title } from "@angular/platform-browser";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { bdApi } from "../lib/bd-api.client";
import { ProductDetailComponent } from "../sections/shop/product-detail.component";
import { StoreNavComponent } from "../sections/store-nav.component";
import type { ProductPageData } from "../shop/shop";

/** Reviews shown at first; each "Show more" adds this many (?reviews=20). */
const REVIEWS_PAGE = 10;

/**
 * One product. The browser loads the product, its reviews, add-ons and
 * related products, and `<bd-product-detail>` lays the page out from the
 * shop's parts (src/app/sections/shop/): option photos, option and size
 * buttons, the price for what's chosen, add to cart (POST /api/bd/cart/add),
 * save, compare, share. It's drawn afresh for each product (tracked by id).
 */
@Component({
	selector: "bd-product-detail-page",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ProductDetailComponent, RouterLink, StoreNavComponent],
	template: `
		<bd-store-nav />
		<div class="bd-page">
			@if (state() === "missing") {
				<div class="bd-empty">
					That product isn't available. <a routerLink="/store">Browse the store</a>
				</div>
			} @else if (data(); as d) {
				@for (page of [d]; track page.product.id) {
					<bd-product-detail cartHref="/cart" contactHref="/#contact" [data]="page" />
				}
			} @else {
				<p class="bd-loading">Loading…</p>
			}
		</div>
	`,
})
export class ProductDetailPage {
	private readonly route = inject(ActivatedRoute);
	private readonly title = inject(Title);

	readonly data = signal<ProductPageData | null>(null);
	readonly state = signal<"loading" | "ready" | "missing">("loading");
	private loadSeq = 0;

	constructor() {
		const browser = isPlatformBrowser(inject(PLATFORM_ID));
		// The same page shows the next product when only the id changes.
		this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
			if (browser) void this.load(params.get("id") ?? "");
		});
	}

	private async load(id: string) {
		const seq = ++this.loadSeq;
		const asked = Number(this.route.snapshot.queryParamMap.get("reviews"));
		const reviewLimit = Math.min(100, asked > REVIEWS_PAGE ? asked : REVIEWS_PAGE);
		const data = id ? await bdApi.productPage(id, reviewLimit) : null;
		if (seq !== this.loadSeq) return;
		if (!data) {
			this.state.set("missing");
			this.title.setTitle("Product — Store");
			return;
		}
		this.data.set(data);
		this.state.set("ready");
		this.title.setTitle(`${data.product.name} — Store`);
	}
}
