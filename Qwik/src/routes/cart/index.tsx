// [bd-file:store]
import { $, component$, useSignal, useTask$ } from "@builder.io/qwik";
import { type DocumentHead, routeLoader$, server$ } from "@builder.io/qwik-city";

import type { CartSnapshot } from "@businessdash/sdk/contracts";

import { Footer } from "../../components/bd/Footer";
import { SiteHeader } from "../../components/bd/SiteHeader";
import { CartLine } from "../../components/bd/shop/CartLine";
import { CartSummary } from "../../components/bd/shop/CartSummary";
import { CheckoutButton } from "../../components/bd/shop/CheckoutButton";
import { CouponForm } from "../../components/bd/shop/CouponForm";
import { StoreNav } from "../../components/bd/StoreNav";
import {
	applyCartCoupon,
	clearCart,
	getCartSnapshot,
	removeCartCoupon,
	removeCartItem,
	startCheckout,
	updateCartItem,
} from "../../lib/bd-store";
import { getCustomerSession } from "../../lib/bd-portal";

/**
 * Cart view. `routeLoader$` reads the visitor cart server-side; the mutations
 * are `server$` RPCs that read/write the `bd_cart_visitor` cookie through
 * `this.cookie` and return a fresh snapshot the client swaps in. Checkout
 * starts a Stripe session and returns the hosted URL to redirect to.
 * Cart amounts are dollars. After each change the new item count goes to the
 * store bar as a `bd:cart-count` event. The page is laid out from the shop's
 * parts (src/components/bd/shop/): a CartLine per item, the CouponForm, the
 * CartSummary and the CheckoutButton.
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

	// The store bar's count follows the cart.
	useTask$(({ track }) => {
		const count = track(() => cart.value?.itemCount ?? 0);
		if (typeof window !== "undefined") {
			window.dispatchEvent(new CustomEvent("bd:cart-count", { detail: count }));
		}
	});

	const snapshot = cart.value;
	const items = snapshot?.items ?? [];

	return (
		<>
			<SiteHeader signedIn={data.value.signedIn} />
			<StoreNav cartCount={data.value.snapshot?.itemCount ?? 0} />
			<main>
				<section class="bd-section bd-section--narrow">
					<div class="bd-section__lead">
						<span class="bd-section__eyebrow">Checkout</span>
						<h2 class="bd-section__title">Your cart</h2>
					</div>

					{items.length === 0 ? (
						<div class="bd-empty">
							Your cart is empty. <a href="/store">Browse the store →</a>
						</div>
					) : (
						<div class="bd-card" style="padding: 2rem; display: flex; flex-direction: column; gap: 1.25rem;">
							{items.map((item) => (
								<CartLine
									disabled={busy.value}
									item={item}
									key={item.id}
									onQuantity$={(quantity) => apply(updateItemRpc(item.id, quantity))}
									onRemove$={() => apply(removeItemRpc(item.id))}
								/>
							))}

							<CouponForm
								code={snapshot?.couponCode}
								disabled={busy.value}
								onApply$={(code) => apply(applyCouponRpc(code))}
								onRemove$={() => apply(removeCouponRpc())}
							/>

							{snapshot ? (
								<CartSummary
									currency={snapshot.currency}
									disabled={busy.value}
									onClear$={() => apply(clearCartRpc())}
									subtotal={snapshot.subtotal}
								/>
							) : null}

							<CheckoutButton busy={busy.value} onCheckout$={checkout} />

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
