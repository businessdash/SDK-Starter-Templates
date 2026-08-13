import { useState } from "react";
import { biab, dollars } from "../lib/biab";
import type { Loose } from "../lib/biab";
import { Link } from "../lib/router";
import { ErrorBox, PageHead, useApi } from "./ui";

export function Cart() {
	const { data, error, loading } = useApi<Loose>(() => biab.cart.get());
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

	const items: Record<string, any>[] = view?.items ?? [];
	const currency: string = view?.currency ?? "USD";

	const checkout = async () => {
		setCheckoutMsg("Starting checkout…");
		try {
			const { url } = await biab.checkout.start({ origin: window.location.origin });
			window.location.href = url;
		} catch (e: any) {
			setCheckoutMsg(`Couldn't start checkout: ${e?.message ?? e}`);
		}
	};

	const applyCoupon = async (code: string) => {
		if (!code) return;
		setCouponMsg("Applying…");
		try {
			setCart(await biab.cart.applyCoupon(code));
			setCouponMsg("");
		} catch (e: any) {
			setCouponMsg(e?.message ?? "Invalid code");
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
							<li key={it.id} className="cart-item">
								{it.productImage ? <img className="cart-item__img" src={it.productImage} alt={it.productName ?? ""} /> : null}
								<div className="cart-item__main">
									<div className="cart-item__name">{it.productName ?? "Item"}</div>
									{it.variantTitle ? <div className="cart-item__variant">{it.variantTitle}</div> : null}
									<div className="cart-item__price">{dollars(it.unitPrice, it.currency ?? currency)} each</div>
								</div>
								<div className="qty">
									<button
										className="qty__btn"
										type="button"
										aria-label="Decrease"
										onClick={async () => setCart(await biab.cart.update(it.id, Math.max(0, it.quantity - 1)))}
									>
										−
									</button>
									<span className="qty__n">{it.quantity}</span>
									<button
										className="qty__btn"
										type="button"
										aria-label="Increase"
										onClick={async () => setCart(await biab.cart.update(it.id, it.quantity + 1))}
									>
										+
									</button>
								</div>
								<div className="cart-item__subtotal">{dollars(it.subtotal, it.currency ?? currency)}</div>
								<button className="cart-item__remove" type="button" onClick={async () => setCart(await biab.cart.remove(it.id))}>
									Remove
								</button>
							</li>
						))}
					</ul>

					{view?.couponCode ? (
						<div className="coupon coupon--applied">
							<span>Coupon {view.couponCode} applied</span>
							<button className="btn btn--ghost btn--sm" type="button" onClick={async () => setCart(await biab.cart.removeCoupon())}>
								Remove
							</button>
						</div>
					) : (
						<form
							className="coupon"
							onSubmit={(e) => {
								e.preventDefault();
								applyCoupon((new FormData(e.currentTarget).get("code") as string)?.trim() ?? "");
							}}
						>
							<input className="coupon__input" type="text" name="code" placeholder="Coupon code" aria-label="Coupon code" />
							<button className="btn btn--ghost btn--sm" type="submit">
								Apply
							</button>
							<span className="coupon__msg">{couponMsg}</span>
						</form>
					)}

					<div className="cart-summary">
						<div className="cart-summary__row">
							<span>
								Subtotal ({view?.itemCount} item{view?.itemCount === 1 ? "" : "s"})
							</span>
							<strong>{dollars(view?.subtotal, currency)}</strong>
						</div>
					</div>

					<div className="cart-actions">
						<button className="btn btn--ghost" type="button" onClick={async () => setCart(await biab.cart.clear())}>
							Clear cart
						</button>
						<button className="btn btn--primary btn--lg" type="button" onClick={checkout}>
							Checkout
						</button>
					</div>
					<p className="cart-checkout__status">{checkoutMsg}</p>
				</>
			)}
		</main>
	);
}
