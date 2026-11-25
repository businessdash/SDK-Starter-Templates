// [bd-file:store]
/**
 * /cart — line items, quantity, coupon, clear, and Stripe checkout, laid
 * out from the shop's parts (/sections/shop/): a cart line per item, the
 * coupon form, the summary and the actions.
 */
import { bd, el } from "/bd.js";
import { cartActions } from "/sections/shop/cart-actions.js";
import { cartLine } from "/sections/shop/cart-line.js";
import { cartSummary } from "/sections/shop/cart-summary.js";
import { couponForm } from "/sections/shop/coupon-form.js";
import { errBox, pageHead } from "./_ui.js";
import { mountStoreNav } from "./_store-nav.js";

export default async function render(root) {
	mountStoreNav();
	root.replaceChildren(pageHead("Your cart"), el("p", { class: "page__loading" }, ["Loading…"]));
	let snap;
	try {
		snap = await bd.cart.get();
	} catch (err) {
		root.replaceChildren(pageHead("Your cart"), errBox(err));
		return;
	}
	paint(root, snap);
}

function paint(root, snap) {
	// The store bar's cart count follows this event.
	window.dispatchEvent(new CustomEvent("bd:cart-count", { detail: Number(snap?.itemCount) || 0 }));
	const items = snap?.items ?? [];
	const currency = snap?.currency ?? "USD";

	if (!items.length) {
		root.replaceChildren(
			pageHead("Your cart"),
			el("p", { class: "muted" }, ["Your cart is empty. ", el("a", { href: "/store" }, ["Browse the store →"])]),
		);
		return;
	}

	const repaint = (next) => paint(root, next);
	root.replaceChildren(
		pageHead("Your cart"),
		el(
			"ul",
			{ class: "cart-list" },
			items.map((item) =>
				cartLine(item, currency, {
					onQuantity: async (quantity) => repaint(await bd.cart.update(item.id, quantity)),
					onRemove: async () => repaint(await bd.cart.remove(item.id)),
				}),
			),
		),
		couponForm(snap.couponCode, {
			onApply: async (code) => repaint(await bd.cart.applyCoupon(code)),
			onRemove: async () => repaint(await bd.cart.removeCoupon()),
		}),
		cartSummary(snap, currency),
		...cartActions({
			onCheckout: async () => (await bd.checkout.start({ origin: location.origin })).url,
			onClear: async () => repaint(await bd.cart.clear()),
		}),
	);
}
