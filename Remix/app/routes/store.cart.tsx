// [bd-file:store]
import { Link, useActionData, useLoaderData } from "react-router";
import { redirect } from "react-router";
import type {
	ActionFunctionArgs,
	LoaderFunctionArgs,
	MetaFunction,
} from "react-router";

import { SiteHeader } from "~/components/SiteHeader";
import { StoreNav } from "~/components/StoreNav";
import { CartLine } from "~/components/shop/CartLine";
import { CartSummary } from "~/components/shop/CartSummary";
import { CouponForm } from "~/components/shop/CouponForm";
import {
	applyCartCoupon,
	clearCart,
	getCartSnapshot,
	removeCartCoupon,
	removeCartItem,
	startCheckout,
	updateCartItem,
	type CartMutationResult,
} from "~/lib/bd-store.server";

export const meta: MetaFunction = () => [{ title: "Cart — Your Business" }];

export async function loader({ request }: LoaderFunctionArgs) {
	const cart = await getCartSnapshot(request);
	return {
		cart: cart
			? {
					currency: cart.currency,
					couponCode: cart.couponCode,
					subtotal: cart.subtotal,
					itemCount: cart.itemCount,
					items: cart.items.map((it) => ({
						id: it.id,
						name: it.productName ?? "Item",
						variantTitle: it.variantTitle,
						image: it.productImage,
						quantity: it.quantity,
						lineTotal: it.subtotal,
					})),
				}
			: null,
	};
}

/** One action, dispatched by the `intent` field, covering every cart mutation
 *  plus checkout (which redirects to the Stripe-hosted URL). */
export async function action({ request }: ActionFunctionArgs) {
	const fd = await request.formData();
	const intent = String(fd.get("intent") ?? "");

	if (intent === "checkout") {
		const origin = new URL(request.url).origin;
		const res = await startCheckout(request, origin);
		if (res.ok) return redirect(res.url);
		return { ok: false as const, error: res.error };
	}

	let result: CartMutationResult;
	switch (intent) {
		case "update":
			result = await updateCartItem(
				request,
				String(fd.get("itemId")),
				Number.parseInt(String(fd.get("quantity") ?? "1"), 10) || 0,
			);
			break;
		case "remove":
			result = await removeCartItem(request, String(fd.get("itemId")));
			break;
		case "apply-coupon":
			result = await applyCartCoupon(request, String(fd.get("code") ?? ""));
			break;
		case "remove-coupon":
			result = await removeCartCoupon(request);
			break;
		case "clear":
			result = await clearCart(request);
			break;
		default:
			return { ok: false as const, error: "Unknown action." };
	}

	if (!result.ok) return { ok: false as const, error: result.error };
	// A visitor reaching /store/cart already holds the `bd_cart_visitor`
	// cookie (it's minted on the first add-to-cart, which redirects here), so
	// no Set-Cookie is needed on these mutations. The mutation succeeded.
	return { ok: true as const, error: null };
}

/**
 * The cart, laid out from the shop's parts: a <CartLine> per item,
 * <CouponForm> and <CartSummary>. Their buttons post to `action` above.
 */
export default function CartPage() {
	const { cart } = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();

	return (
		<>
			<SiteHeader />
			<StoreNav cartCount={cart?.itemCount ?? 0} />
			<main>
				<section className="section">
					<h1 className="section__title">Your cart</h1>
					{actionData && actionData.ok === false ? (
						<p className="error">{actionData.error}</p>
					) : null}
					{!cart || cart.items.length === 0 ? (
						<p className="muted">
							Your cart is empty. <Link to="/store">Browse the store →</Link>
						</p>
					) : (
						<>
							<ul className="cart-list">
								{cart.items.map((it) => (
									<CartLine currency={cart.currency} item={it} key={it.id} />
								))}
							</ul>

							<div className="cart-foot">
								<CouponForm code={cart.couponCode} />
								<CartSummary currency={cart.currency} subtotal={cart.subtotal} />
							</div>
						</>
					)}
				</section>
			</main>
		</>
	);
}
