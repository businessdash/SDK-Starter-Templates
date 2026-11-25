// [bd-file:store]
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { bdApi, type CartSnapshot } from "../lib/bd-api.client";
import { CartActionsComponent } from "../sections/shop/cart-actions.component";
import { CartLineComponent } from "../sections/shop/cart-line.component";
import { CartSummaryComponent } from "../sections/shop/cart-summary.component";
import { CouponFormComponent } from "../sections/shop/coupon-form.component";
import { StoreNavComponent } from "../sections/store-nav.component";

/**
 * Cart view: line items with quantity controls, coupon apply/remove
 * (reactive form), clear, and "Checkout" → Stripe. All mutations go through
 * the server `/api/bd/cart/*` endpoints which carry the httpOnly visitor
 * cookie. ?status=success|cancel (from the Stripe return) shows a banner.
 * Cart amounts are dollars. Each change sends the new item count
 * (`bd:cart-count`) to the store bar. The page is laid out from the shop's
 * parts (src/app/sections/shop/): a cart line per item, the coupon form, the
 * summary and the actions.
 */
@Component({
	selector: "bd-cart-page",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		CartActionsComponent,
		CartLineComponent,
		CartSummaryComponent,
		CouponFormComponent,
		RouterLink,
		StoreNavComponent,
	],
	template: `
		<bd-store-nav />
		<section class="section">
			<h1 class="section__title">Your cart</h1>

			@if (status() === "success") {
				<p class="muted">Thanks — your order is confirmed.</p>
			} @else if (status() === "cancel") {
				<p class="muted">Checkout cancelled. Your cart is still here.</p>
			}

			@if (cart(); as c) {
				@if (c.items.length === 0) {
					<p class="muted">Your cart is empty. <a routerLink="/store">Browse the store</a>.</p>
				} @else {
					<ul class="cart-list">
						@for (item of c.items; track item.id) {
							<li
								bd-cart-line
								[currency]="c.currency"
								[item]="item"
								(quantity)="setQty(item.id, $event)"
								(remove)="remove(item.id)"
							></li>
						}
					</ul>

					<bd-coupon-form [code]="c.couponCode" (apply)="applyCoupon($event)" (remove)="removeCoupon()" />
					<bd-cart-summary [currency]="c.currency" [subtotal]="c.subtotal" />
					<bd-cart-actions [busy]="busy()" (checkout)="checkout()" (clear)="clear()" />
				}
			} @else {
				<p class="muted">Your cart is empty. <a routerLink="/store">Browse the store</a>.</p>
			}
		</section>
	`,
})
export class CartPage implements OnInit {
	private readonly route = inject(ActivatedRoute);
	readonly cart = signal<CartSnapshot>(null);
	readonly busy = signal(false);
	readonly status = signal<string | null>(null);

	async ngOnInit() {
		this.status.set(this.route.snapshot.queryParamMap.get("status"));
		this.cart.set(await bdApi.cart());
	}

	/** The cart after a change, and its count for the store bar. */
	private show(next: CartSnapshot) {
		this.cart.set(next);
		window.dispatchEvent(new CustomEvent("bd:cart-count", { detail: next?.itemCount ?? 0 }));
	}

	async setQty(itemId: string, quantity: number) {
		const next = await bdApi.updateCartItem(itemId, Math.max(0, quantity));
		if (next !== null) this.show(next);
	}

	async remove(itemId: string) {
		const next = await bdApi.removeCartItem(itemId);
		if (next !== null) this.show(next);
	}

	async applyCoupon(code: string) {
		const next = await bdApi.applyCoupon(code);
		if (next !== null) this.show(next);
	}

	async removeCoupon() {
		const next = await bdApi.removeCoupon();
		if (next !== null) this.show(next);
	}

	async clear() {
		const next = await bdApi.clearCart();
		if (next !== null) this.show(next);
	}

	async checkout() {
		this.busy.set(true);
		const res = await bdApi.startCheckout();
		this.busy.set(false);
		if (res?.url) window.location.href = res.url;
	}
}
