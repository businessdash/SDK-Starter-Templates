// [bd-file:store]
import type { CartSnapshot } from "@businessdash/sdk/contracts";
import { createFileRoute, Link } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import { StoreNav } from "../components/bd/StoreNav";
import { CartActions } from "../components/bd/shop/CartActions";
import { CartLine } from "../components/bd/shop/CartLine";
import { CartSummary } from "../components/bd/shop/CartSummary";
import { CouponForm } from "../components/bd/shop/CouponForm";
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
 * re-render. "Checkout" starts a Stripe session and redirects. Cart amounts
 * are dollars. After each change the new item count goes to the store bar
 * as a `bd:cart-count` event.
 *
 * The page is laid out from the shop's parts (src/components/bd/shop/): a
 * <CartLine> per item, <CouponForm>, <CartSummary> and <CartActions>.
 */
export const Route = createFileRoute("/store/cart")({
	component: CartView,
	loader: () => getCart(),
});

function CartView() {
	const initial = Route.useLoaderData();
	const [cart, setCart] = createSignal<CartSnapshot | null>(initial());
	const [busy, setBusy] = createSignal(false);
	const [error, setError] = createSignal<string | null>(null);

	function apply(res: CartResult) {
		setBusy(false);
		if (res.ok) {
			setCart(res.snapshot);
			setError(null);
			window.dispatchEvent(
				new CustomEvent("bd:cart-count", { detail: res.snapshot.itemCount }),
			);
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
	async function addCoupon(code: string) {
		setBusy(true);
		apply(await applyCartCoupon({ data: { code } }));
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
		<>
			<StoreNav cartCount={initial()?.itemCount ?? 0} />
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
									<CartLine
										disabled={busy()}
										item={item}
										onQuantity={(quantity) => setQty(item.id, quantity)}
										onRemove={() => remove(item.id)}
									/>
								)}
							</For>

							<CouponForm
								code={cart()?.couponCode}
								disabled={busy()}
								onApply={addCoupon}
								onRemove={dropCoupon}
							/>
							<CartSummary
								currency={cart()?.currency}
								subtotal={cart()?.subtotal ?? 0}
							/>
							<CartActions
								busy={busy()}
								onCheckout={checkout}
								onClear={empty}
							/>

							<Show when={error()}>
								<div style="color: var(--danger); background: var(--danger-bg); padding: 0.75rem 1rem; border-radius: 0.5rem; font-size: 0.9rem;">
									{error()}
								</div>
							</Show>
						</div>
					</Show>
				</section>
			</main>
		</>
	);
}
