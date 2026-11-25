// [bd-file:store,subscriptions]
import {
	ChangeDetectionStrategy,
	Component,
	CUSTOM_ELEMENTS_SCHEMA,
	// [bd:store]
	DestroyRef,
	afterNextRender,
	inject,
	signal,
	// [/bd:store]
} from "@angular/core";
import { RouterLink } from "@angular/router";
// [bd:store]
import { bdApi } from "../lib/bd-api.client";
// [/bd:store]

/**
 * The bar under the header on every store page: products and plans on the
 * left; wishlist, compare and the cart with their counts on the right.
 *
 * The browser loads the shop's custom elements here (src/app/shop/), which
 * fill in the wishlist and compare counts from this browser's lists and draw
 * the product page, wishlist and compare table. The cart count comes from
 * /api/bd/cart and then follows each `bd:cart-count` event: the product page
 * sends one when it adds, the cart page after every change.
 */
@Component({
	selector: "bd-store-nav",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [RouterLink],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	template: `
		<nav aria-label="Store" class="store-nav">
			<div class="store-nav__links">
				<!-- [bd:store] -->
				<a routerLink="/store">Products</a>
				<!-- [/bd:store] -->
				<!-- [bd:subscriptions] -->
				<a routerLink="/subscriptions">Plans</a>
				<!-- [/bd:subscriptions] -->
			</div>
			<!-- [bd:store] -->
			<div class="store-nav__links">
				<a routerLink="/store/wishlist">Wishlist<bd-saved-count data-list="wishlist" /></a>
				<a routerLink="/store/compare">Compare<bd-saved-count data-list="compare" /></a>
				<a class="store-nav__cart" routerLink="/cart">
					Cart
					@if (cartCount() > 0) {
						<span class="store-nav__badge">{{ cartCount() }}</span>
					}
				</a>
			</div>
			<!-- [/bd:store] -->
		</nav>
	`,
})
export class StoreNavComponent {
	// [bd:store]
	readonly cartCount = signal(0);

	constructor() {
		const destroyRef = inject(DestroyRef);
		afterNextRender(() => {
			void import("../shop/shop-elements");
			const onCount = (event: Event) => this.cartCount.set(Number((event as CustomEvent<number>).detail) || 0);
			window.addEventListener("bd:cart-count", onCount);
			destroyRef.onDestroy(() => window.removeEventListener("bd:cart-count", onCount));
			void bdApi.cart().then((cart) => this.cartCount.set(cart?.itemCount ?? 0));
		});
	}
	// [/bd:store]
}
