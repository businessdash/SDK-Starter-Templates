import { $, component$, useSignal } from "@builder.io/qwik";
import { type DocumentHead, routeLoader$, server$ } from "@builder.io/qwik-city";

import type { CartSnapshot } from "@businessdash/sdk/contracts";

import { Footer } from "../../components/biab/Footer";
import { SiteHeader } from "../../components/biab/SiteHeader";
import {
	applyCartCoupon,
	clearCart,
	formatMoney,
	getCartSnapshot,
	removeCartCoupon,
	removeCartItem,
	startCheckout,
	updateCartItem,
} from "../../lib/biab-store";
import { getCustomerSession } from "../../lib/biab-portal";

/**
 * Cart view. `routeLoader$` reads the visitor cart server-side; the mutations
 * are `server$` RPCs that read/write the `biab_cart_visitor` cookie through
 * `this.cookie` and return a fresh snapshot the client swaps in. Checkout
 * starts a Stripe session and returns the hosted URL to redirect to.
 */
export const useCart = routeLoader$(async ({ cookie }) => {
	const [snapshot, session] = await Promise.all([
		getCartSnapshot(cookie),
		getCustomerSession(cookie),
	]);
	return { snapshot, signedIn: !!session };
});

const updateItemRpc = server$(async function (
	this,
	itemId: string,
	quantity: number,
) {
	return await updateCartItem(this.cookie, itemId, quantity);
});

const removeItemRpc = server$(async function (this, itemId: string) {
	return await removeCartItem(this.cookie, itemId);
});

const applyCouponRpc = server$(async function (this, code: string) {
	return await applyCartCoupon(this.cookie, code);
});

const removeCouponRpc = server$(async function (this) {
	return await removeCartCoupon(this.cookie);
});

const clearCartRpc = server$(async function (this) {
	return await clearCart(this.cookie);
});

const startCheckoutRpc = server$(async function (this) {
	return await startCheckout(this.cookie, this.url.origin);
});

export default component$(() => {
	const data = useCart();
	const cart = useSignal<CartSnapshot | null>(data.value.snapshot);
	const couponCode = useSignal("");
	const error = useSignal<string | null>(null);
	const busy = useSignal(false);

	const apply = $(
		async (
			result: Promise<
				{ ok: true; snapshot: CartSnapshot } | { ok: false; error: string }
			>,
		) => {
			busy.value = true;
			error.value = null;
			const res = await result;
			busy.value = false;
			if (res.ok) cart.value = res.snapshot;
			else error.value = res.error;
		},
	);

	const checkout = $(async () => {
		busy.value = true;
		error.value = null;
		const res = await startCheckoutRpc();
		busy.value = false;
		if (res.ok) {
			window.location.href = res.url;
		} else {
			error.value = res.error;
		}
	});

	const snapshot = cart.value;
	const items = snapshot?.items ?? [];

	return (
		<>
			<SiteHeader signedIn={data.value.signedIn} cartCount={snapshot?.itemCount ?? 0} />
			<main>
				<section class="biab-section biab-section--narrow">
					<div class="biab-section__lead">
						<span class="biab-section__eyebrow">Checkout</span>
						<h2 class="biab-section__title">Your cart</h2>
					</div>

					{items.length === 0 ? (
						<div class="biab-empty">
							Your cart is empty. <a href="/store">Browse the store →</a>
						</div>
					) : (
						<div class="biab-card" style="padding: 2rem; display: flex; flex-direction: column; gap: 1.25rem;">
							{items.map((item) => (
								<div
									key={item.id}
									style="display: flex; gap: 1rem; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 1rem;"
								>
									{item.productImage ? (
										<img
											alt={item.productName ?? "Item"}
											src={item.productImage}
											style="width: 64px; height: 64px; border-radius: 0.5rem; object-fit: cover;"
										/>
									) : null}
									<div style="flex: 1;">
										<div style="font-weight: 600; color: var(--title);">
											{item.productName ?? "Item"}
										</div>
										{item.variantTitle ? (
											<div style="color: var(--text-muted); font-size: 0.85rem;">
												{item.variantTitle}
											</div>
										) : null}
										<div style="color: var(--accent); font-weight: 600;">
											{formatMoney(item.subtotal, item.currency)}
										</div>
									</div>
									<div style="display: flex; align-items: center; gap: 0.5rem;">
										<button
											aria-label="Decrease quantity"
											class="slot-button"
											disabled={busy.value}
											onClick$={() =>
												apply(updateItemRpc(item.id, item.quantity - 1))
											}
											type="button"
										>
											−
										</button>
										<span style="min-width: 1.5rem; text-align: center;">
											{item.quantity}
										</span>
										<button
											aria-label="Increase quantity"
											class="slot-button"
											disabled={busy.value}
											onClick$={() =>
												apply(updateItemRpc(item.id, item.quantity + 1))
											}
											type="button"
										>
											+
										</button>
										<button
											class="biab-btn biab-btn--ghost"
											disabled={busy.value}
											onClick$={() => apply(removeItemRpc(item.id))}
											type="button"
										>
											Remove
										</button>
									</div>
								</div>
							))}

							<div style="display: flex; gap: 0.5rem; align-items: flex-end;">
								<div style="flex: 1;">
									<label class="biab-label" for="coupon">
										Coupon
									</label>
									<input
										bind:value={couponCode}
										class="biab-input"
										id="coupon"
										placeholder={snapshot?.couponCode ?? "Code"}
									/>
								</div>
								{snapshot?.couponCode ? (
									<button
										class="biab-btn biab-btn--ghost"
										disabled={busy.value}
										onClick$={() => apply(removeCouponRpc())}
										type="button"
									>
										Remove coupon
									</button>
								) : (
									<button
										class="biab-btn biab-btn--ghost"
										disabled={busy.value || !couponCode.value}
										onClick$={() => apply(applyCouponRpc(couponCode.value))}
										type="button"
									>
										Apply
									</button>
								)}
							</div>

							<div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.5rem;">
								<button
									class="biab-btn biab-btn--ghost"
									disabled={busy.value}
									onClick$={() => apply(clearCartRpc())}
									type="button"
								>
									Clear cart
								</button>
								<div style="font-size: 1.15rem; font-weight: 700; color: var(--title);">
									{snapshot
										? formatMoney(snapshot.subtotal, snapshot.currency)
										: ""}
								</div>
							</div>

							<button
								class="biab-btn"
								disabled={busy.value}
								onClick$={checkout}
								type="button"
							>
								{busy.value ? "Working…" : "Checkout with Stripe"}
							</button>

							{error.value ? (
								<div style="color: var(--danger); background: var(--danger-bg); padding: 0.75rem 1rem; border-radius: 0.5rem; font-size: 0.9rem;">
									{error.value}
								</div>
							) : null}
						</div>
					)}
				</section>
			</main>
			<Footer />
		</>
	);
});

export const head: DocumentHead = {
	title: "Cart — Your Business",
	meta: [{ name: "description", content: "Your shopping cart." }],
};
