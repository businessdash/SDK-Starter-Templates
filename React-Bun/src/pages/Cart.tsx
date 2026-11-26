// [bd-file:store]
import { useState } from "react";
import { bd } from "../lib/bd";
import type { Loose } from "../lib/bd";
import { Link } from "../lib/router";
import { ErrorBox, PageHead } from "./ui";
import { useApi } from "./use-api";
import { StoreNav } from "../components/StoreNav";
import { CartActions } from "../components/shop/CartActions";
import { CartLine } from "../components/shop/CartLine";
import { CartSummary } from "../components/shop/CartSummary";
import { CouponForm } from "../components/shop/CouponForm";

/**
 * The cart, under the store bar, laid out from the shop's parts: a
 * <CartLine> per item, <CouponForm>, <CartSummary> and <CartActions>.
 */
export function Cart() {
	return (
		<>
			<StoreNav />
			<CartBody />
		</>
	);
}

function CartBody() {
	const { data, error, loading } = useApi<Loose>(() => bd.cart.get());
	const [cart, setCart] = useState<Loose | null>(null);
	const [couponMsg, setCouponMsg] = useState("");
	const [checkoutMsg, setCheckoutMsg] = useState("");

	const view = cart ?? data;
	if (loading && !cart)
		return (
			<main className="page">
				<PageHead title="Your cart" />
				<p className="muted">Loading…</p>
			</main>
		);
	if (error && !cart)
		return (
			<main className="page">
				<PageHead title="Your cart" />
				<ErrorBox error={error} />
			</main>
		);

	const items: Loose[] = view?.items ?? [];
	const currency: string = view?.currency ?? "USD";

	const checkout = async () => {
		setCheckoutMsg("Starting checkout…");
		try {
			const { url } = await bd.checkout.start({ origin: window.location.origin });
			window.location.assign(url);
		} catch (e) {
			setCheckoutMsg(`Couldn't start checkout: ${e instanceof Error ? e.message : String(e)}`);
		}
	};

	const applyCoupon = async (code: string) => {
		if (!code) return;
		setCouponMsg("Applying…");
		try {
			setCart(await bd.cart.applyCoupon(code));
			setCouponMsg("");
		} catch (e) {
			setCouponMsg(e instanceof Error ? e.message : "Invalid code");
		}
	};

	return (
		<main className="page">
			<PageHead title="Your cart" />
			{items.length === 0 ? (
				<p className="muted">
					Your cart is empty. <Link to="/store">Browse the store →</Link>
				</p>
			) : (
				<>
					<ul className="cart-list">
						{items.map((it) => (
							<CartLine
								key={it.id}
								item={it}
								currency={currency}
								onQuantity={async (quantity) => setCart(await bd.cart.update(it.id, quantity))}
								onRemove={async () => setCart(await bd.cart.remove(it.id))}
							/>
						))}
					</ul>

					<CouponForm
						code={view?.couponCode}
						message={couponMsg}
						onApply={applyCoupon}
						onRemove={async () => setCart(await bd.cart.removeCoupon())}
					/>
					<CartSummary itemCount={view?.itemCount} subtotal={view?.subtotal} currency={currency} />
					<CartActions
						status={checkoutMsg}
						onClear={async () => setCart(await bd.cart.clear())}
						onCheckout={checkout}
					/>
				</>
			)}
		</main>
	);
}
