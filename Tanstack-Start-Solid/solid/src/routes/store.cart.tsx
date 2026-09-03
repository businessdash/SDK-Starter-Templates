import type { CartSnapshot } from "@businessdash/sdk/contracts";
import { createFileRoute, Link } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";

import { formatMoney } from "../components/bd/money";
import {
	applyCartCoupon,
	type CartResult,
	clearCart,
	getCart,
	removeCartCoupon,
	removeCartItem,
	startCheckout,
	updateCartItem,
} from "../lib/bd-server-fns";

/**
 * Cart. The loader reads the current snapshot via the visitor token
 * (httpOnly cookie). Quantity / remove / coupon / clear each call a
 * server fn that returns the new snapshot — we hold it in a signal and
 * re-render. "Checkout" starts a Stripe session and redirects.
 */
export const Route = createFileRoute("/store/cart")({
	component: CartView,
	loader: () => getCart(),
});

function CartView() {
	const initial = Route.useLoaderData();
	const [cart, setCart] = createSignal<CartSnapshot | null>(initial());
	const [busy, setBusy] = createSignal(false);
	const [coupon, setCoupon] = createSignal("");
	const [error, setError] = createSignal<string | null>(null);

	function apply(res: CartResult) {
		setBusy(false);
		if (res.ok) {
			setCart(res.snapshot);
			setError(null);
		} else {
			setError(res.error);
		}
	}

	async function setQty(itemId: string, quantity: number) {
		setBusy(true);
		apply(await updateCartItem({ data: { itemId, quantity } }));
	}
	async function remove(itemId: string) {
		setBusy(true);
		apply(await removeCartItem({ data: { itemId } }));
	}
	async function addCoupon() {
		if (!coupon().trim()) return;
		setBusy(true);
		apply(await applyCartCoupon({ data: { code: coupon().trim() } }));
	}
	async function dropCoupon() {
		setBusy(true);
		apply(await removeCartCoupon());
	}
	async function empty() {
		setBusy(true);
		apply(await clearCart());
	}
	async function checkout() {
		setBusy(true);
		setError(null);
		const res = await startCheckout({
			data: { origin: window.location.origin },
		});
		setBusy(false);
		if (res.ok) window.location.href = res.url;
		else setError(res.error);
	}

	const isEmpty = () => {
		const c = cart();
		return !c || c.items.length === 0;
	};

	return (
		<main>
			<section class="bd-section bd-section--narrow">
				<div class="bd-section__lead">
					<span class="bd-section__eyebrow">Checkout</span>
					<h1 class="bd-section__title">Your cart</h1>
				</div>

				<Show
					when={!isEmpty()}
					fallback={
						<div class="bd-empty">
							Your cart is empty. <Link to="/store">Browse the store →</Link>
						</div>
					}
				>
					<div
						class="bd-card"
						style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem;"
					>
						<For each={cart()?.items ?? []}>
							{(item) => (
								<div style="display: flex; align-items: center; gap: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border);">
									<Show when={item.productImage}>
										<img
											src={item.productImage ?? ""}
											alt={item.productName ?? "Item"}
											style="width: 64px; height: 64px; object-fit: cover; border-radius: 0.5rem;"
										/>
									</Show>
									<div style="flex: 1;">
										<div style="font-weight: 600; color: var(--title);">
											{item.productName ?? "Item"}
										</div>
										<Show when={item.variantTitle}>
											<div style="font-size: 0.82rem; color: var(--text-muted);">
												{item.variantTitle}
											</div>
										</Show>
										<div style="font-size: 0.85rem; color: var(--text-muted);">
											{formatMoney(
												Math.round(item.unitPrice * 100),
												item.currency,
											)}{" "}
											each
										</div>
									</div>
									<div style="display: flex; align-items: center; gap: 0.5rem;">
										<button
											type="button"
											class="slot-button"
											disabled={busy()}
											onClick={() =>
												setQty(item.id, Math.max(0, item.quantity - 1))
											}
										>
											−
										</button>
										<span style="min-width: 1.5rem; text-align: center;">
											{item.quantity}
										</span>
										<button
											type="button"
											class="slot-button"
											disabled={busy()}
											onClick={() => setQty(item.id, item.quantity + 1)}
										>
											+
										</button>
									</div>
									<button
										type="button"
										class="bd-btn bd-btn--ghost"
										disabled={busy()}
										onClick={() => remove(item.id)}
									>
										Remove
									</button>
								</div>
							)}
						</For>

						<div style="display: flex; gap: 0.5rem; align-items: flex-end;">
							<div style="flex: 1;">
								<label class="bd-label" for="coupon">
									Coupon code
								</label>
								<input
									id="coupon"
									class="bd-input"
									placeholder="SAVE10"
									value={coupon()}
									onInput={(e) => setCoupon(e.currentTarget.value)}
								/>
							</div>
							<Show
								when={cart()?.couponCode}
								fallback={
									<button
										type="button"
										class="bd-btn bd-btn--ghost"
										disabled={busy()}
										onClick={addCoupon}
									>
										Apply
									</button>
								}
							>
								<button
									type="button"
									class="bd-btn bd-btn--ghost"
									disabled={busy()}
									onClick={dropCoupon}
								>
									Remove {cart()?.couponCode}
								</button>
							</Show>
						</div>

						<div style="display: flex; justify-content: space-between; font-weight: 700; color: var(--title); font-size: 1.1rem; padding-top: 0.5rem;">
							<span>Subtotal</span>
							<span>
								{formatMoney(
									Math.round((cart()?.subtotal ?? 0) * 100),
									cart()?.currency,
								)}
							</span>
						</div>

						<div style="display: flex; gap: 0.75rem;">
							<button
								type="button"
								class="bd-btn"
								style="flex: 1;"
								disabled={busy()}
								onClick={checkout}
							>
								{busy() ? "Working…" : "Checkout with Stripe"}
							</button>
							<button
								type="button"
								class="bd-btn bd-btn--ghost"
								disabled={busy()}
								onClick={empty}
							>
								Clear
							</button>
						</div>

						<Show when={error()}>
							<div style="color: var(--danger); background: var(--danger-bg); padding: 0.75rem 1rem; border-radius: 0.5rem; font-size: 0.9rem;">
								{error()}
							</div>
						</Show>
					</div>
				</Show>
			</section>
		</main>
	);
}
