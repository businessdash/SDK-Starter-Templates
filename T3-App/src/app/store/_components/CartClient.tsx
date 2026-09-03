"use client";

import type { CartSnapshot } from "@businessdash/sdk/contracts";
import Link from "next/link";
import { useState, useTransition } from "react";

import {
	applyCouponAction,
	type CartActionResult,
	clearCartAction,
	removeCartItemAction,
	removeCouponAction,
	startCheckoutAction,
	updateCartItemAction,
} from "@/app/_actions/store";

import { usd } from "./store-utils";

/** Interactive cart: line-item qty +/-, remove, clear, apply/remove coupon,
 *  and "checkout" which redirects to the Stripe-hosted URL. Each mutation
 *  swaps in the fresh `CartSnapshot` the Server Action returns. */
export function CartClient({ initial }: { initial: CartSnapshot }) {
	const [snapshot, setSnapshot] = useState<CartSnapshot>(initial);
	const [couponCode, setCouponCode] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();
	const [checkoutPending, setCheckoutPending] = useState(false);

	const currency = snapshot.currency || "USD";

	function apply(action: () => Promise<CartActionResult>) {
		setError(null);
		startTransition(async () => {
			const res = await action();
			if (res.ok) setSnapshot(res.snapshot);
			else setError(res.error);
		});
	}

	async function checkout() {
		setError(null);
		setCheckoutPending(true);
		try {
			const res = await startCheckoutAction(window.location.origin);
			if (res.ok) window.location.href = res.url;
			else {
				setError(res.error);
				setCheckoutPending(false);
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
			setCheckoutPending(false);
		}
	}

	return (
		<div className="cart">
			<ul className="cart__items">
				{snapshot.items.map((item) => (
					<li className="cart__item" key={item.id}>
						<div className="cart__thumb">
							{item.productImage ? (
								// eslint-disable-next-line @next/next/no-img-element
								<img
									alt={item.productName ?? "Product"}
									src={item.productImage}
								/>
							) : null}
						</div>
						<div className="cart__line">
							<div className="cart__lineTop">
								<div>
									<p className="cart__name">{item.productName ?? "Product"}</p>
									{item.variantTitle ? (
										<p className="cart__variant">{item.variantTitle}</p>
									) : null}
								</div>
								<p className="cart__subtotal">{usd(item.subtotal, currency)}</p>
							</div>
							<div className="cart__controls">
								<button
									className="cart__step"
									disabled={pending}
									onClick={() =>
										apply(() =>
											updateCartItemAction(
												item.id,
												Math.max(1, item.quantity - 1),
											),
										)
									}
									type="button"
								>
									−
								</button>
								<span className="cart__qty">{item.quantity}</span>
								<button
									className="cart__step"
									disabled={pending}
									onClick={() =>
										apply(() =>
											updateCartItemAction(item.id, item.quantity + 1),
										)
									}
									type="button"
								>
									+
								</button>
								<span className="cart__unit">
									{usd(item.unitPrice, currency)} ea
								</span>
								<button
									className="cart__remove"
									disabled={pending}
									onClick={() => apply(() => removeCartItemAction(item.id))}
									type="button"
								>
									Remove
								</button>
							</div>
						</div>
					</li>
				))}
			</ul>

			<div className="cart__summary bd-card">
				<h2>Summary</h2>

				{snapshot.couponCode ? (
					<div className="cart__coupon">
						<span className="cart__couponOk">
							Coupon: {snapshot.couponCode}
						</span>
						<button
							className="cart__remove"
							disabled={pending}
							onClick={() => apply(() => removeCouponAction())}
							type="button"
						>
							Remove
						</button>
					</div>
				) : (
					<div className="cart__couponRow">
						<input
							className="bd-input"
							onChange={(e) => setCouponCode(e.target.value)}
							placeholder="Coupon code"
							value={couponCode}
						/>
						<button
							className="bd-btn bd-btn--ghost"
							disabled={pending || !couponCode.trim()}
							onClick={() => apply(() => applyCouponAction(couponCode.trim()))}
							type="button"
						>
							Apply
						</button>
					</div>
				)}

				<div className="cart__total">
					<span>
						Subtotal ({snapshot.itemCount} item
						{snapshot.itemCount === 1 ? "" : "s"})
					</span>
					<span className="cart__totalAmount">
						{usd(snapshot.subtotal, currency)}
					</span>
				</div>

				<button
					className="bd-btn cart__checkout"
					disabled={checkoutPending || pending}
					onClick={checkout}
					type="button"
				>
					{checkoutPending ? "Starting checkout…" : "Checkout"}
				</button>

				{error ? <p className="cart__err">{error}</p> : null}

				<button
					className="cart__clear"
					disabled={pending}
					onClick={() => apply(() => clearCartAction())}
					type="button"
				>
					Clear cart
				</button>
				<Link className="cart__continue" href="/store">
					Continue shopping
				</Link>
			</div>
		</div>
	);
}
