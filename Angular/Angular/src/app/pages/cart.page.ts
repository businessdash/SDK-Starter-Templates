import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { bdApi, type CartSnapshot } from "../lib/bd-api.client";

/**
 * Cart view: line items with quantity controls, coupon apply/remove
 * (reactive form), clear, and "Checkout" → Stripe. All mutations go through
 * the server `/api/bd/cart/*` endpoints which carry the httpOnly visitor
 * cookie. ?status=success|cancel (from the Stripe return) shows a banner.
 */
@Component({
	selector: "bd-cart-page",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ReactiveFormsModule, RouterLink],
	template: `
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
							<li class="cart-row">
								<span class="cart-row__name">{{ item.productName || "Item" }}</span>
								<span class="cart-row__qty">
									<button type="button" (click)="setQty(item.id, item.quantity - 1)" aria-label="Decrease">−</button>
									{{ item.quantity }}
									<button type="button" (click)="setQty(item.id, item.quantity + 1)" aria-label="Increase">+</button>
								</span>
								<span class="cart-row__price">{{ money(item.subtotal, c.currency) }}</span>
								<button class="cart-row__remove" type="button" (click)="remove(item.id)">Remove</button>
							</li>
						}
					</ul>

					<form class="coupon" [formGroup]="couponForm" (ngSubmit)="applyCoupon()">
						<label>
							Coupon
							<input formControlName="code" placeholder="Code" />
						</label>
						<button class="bd-btn bd-btn--ghost" type="submit" [disabled]="couponForm.invalid">Apply</button>
						@if (c.couponCode) {
							<button class="bd-btn bd-btn--ghost" type="button" (click)="removeCoupon()">
								Remove “{{ c.couponCode }}”
							</button>
						}
					</form>

					<p class="cart-total">Subtotal: <strong>{{ money(c.subtotal, c.currency) }}</strong></p>

					<div class="cart-actions">
						<button class="bd-btn" type="button" (click)="checkout()" [disabled]="busy()">
							{{ busy() ? "Starting…" : "Checkout" }}
						</button>
						<button class="bd-btn bd-btn--ghost" type="button" (click)="clear()">Clear cart</button>
					</div>
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

	readonly couponForm = new FormGroup({
		code: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
	});

	async ngOnInit() {
		this.status.set(this.route.snapshot.queryParamMap.get("status"));
		this.cart.set(await bdApi.cart());
	}

	money(cents: number, currency: string): string {
		const value = (cents ?? 0) / 100;
		try {
			return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(value);
		} catch {
			return `$${value.toFixed(2)}`;
		}
	}

	async setQty(itemId: string, quantity: number) {
		const next = await bdApi.updateCartItem(itemId, Math.max(0, quantity));
		if (next !== null) this.cart.set(next);
	}

	async remove(itemId: string) {
		const next = await bdApi.removeCartItem(itemId);
		if (next !== null) this.cart.set(next);
	}

	async applyCoupon() {
		const code = this.couponForm.controls.code.value.trim();
		if (!code) return;
		const next = await bdApi.applyCoupon(code);
		if (next !== null) this.cart.set(next);
	}

	async removeCoupon() {
		const next = await bdApi.removeCoupon();
		if (next !== null) this.cart.set(next);
	}

	async clear() {
		const next = await bdApi.clearCart();
		if (next !== null) this.cart.set(next);
	}

	async checkout() {
		this.busy.set(true);
		const res = await bdApi.startCheckout();
		this.busy.set(false);
		if (res?.url) window.location.href = res.url;
	}
}
