/** /cart — line items, quantity, coupon, clear, and Stripe checkout. */
import { biab, el, dollars } from "/biab.js";
import { errBox, pageHead } from "./_ui.js";

export default async function render(root) {
	root.replaceChildren(pageHead("Your cart"), el("p", { class: "page__loading" }, ["Loading…"]));
	let snap;
	try {
		snap = await biab.cart.get();
	} catch (err) {
		root.replaceChildren(pageHead("Your cart"), errBox(err));
		return;
	}
	paint(root, snap);
}

function paint(root, snap) {
	const items = snap?.items ?? [];
	const currency = snap?.currency ?? "USD";
	const nodes = [pageHead("Your cart")];

	if (!items.length) {
		nodes.push(el("p", { class: "muted" }, ["Your cart is empty. ", el("a", { href: "/store" }, ["Browse the store →"])]));
		root.replaceChildren(...nodes);
		return;
	}

	const repaint = (next) => paint(root, next);

	nodes.push(
		el(
			"ul",
			{ class: "cart-list" },
			items.map((it) =>
				el("li", { class: "cart-item" }, [
					it.productImage ? el("img", { class: "cart-item__img", src: it.productImage, alt: it.productName ?? "" }) : null,
					el("div", { class: "cart-item__main" }, [
						el("div", { class: "cart-item__name" }, [it.productName ?? "Item"]),
						it.variantTitle ? el("div", { class: "cart-item__variant" }, [it.variantTitle]) : null,
						el("div", { class: "cart-item__price" }, [`${dollars(it.unitPrice, it.currency ?? currency)} each`]),
					]),
					qtyControl(it, repaint),
					el("div", { class: "cart-item__subtotal" }, [dollars(it.subtotal, it.currency ?? currency)]),
					el("button", {
						class: "cart-item__remove",
						type: "button",
						"aria-label": "Remove",
						onClick: async () => repaint(await biab.cart.remove(it.id)),
					}, ["Remove"]),
				]),
			),
		),
	);

	nodes.push(couponRow(snap, repaint));

	nodes.push(
		el("div", { class: "cart-summary" }, [
			el("div", { class: "cart-summary__row" }, [
				el("span", {}, [`Subtotal (${snap.itemCount} item${snap.itemCount === 1 ? "" : "s"})`]),
				el("strong", {}, [dollars(snap.subtotal, currency)]),
			]),
		]),
	);

	const checkoutStatus = el("p", { class: "cart-checkout__status" }, []);
	const checkoutBtn = el("button", {
		class: "btn btn--primary btn--lg",
		type: "button",
		onClick: async () => {
			checkoutBtn.disabled = true;
			checkoutStatus.textContent = "Starting checkout…";
			try {
				const { url } = await biab.checkout.start({ origin: location.origin });
				location.href = url;
			} catch (err) {
				checkoutStatus.textContent = `Couldn't start checkout: ${err?.message ?? err}`;
				checkoutBtn.disabled = false;
			}
		},
	}, ["Checkout"]);

	nodes.push(
		el("div", { class: "cart-actions" }, [
			el("button", {
				class: "btn btn--ghost",
				type: "button",
				onClick: async () => repaint(await biab.cart.clear()),
			}, ["Clear cart"]),
			checkoutBtn,
		]),
		checkoutStatus,
	);

	root.replaceChildren(...nodes);
}

function qtyControl(it, repaint) {
	const dec = el("button", {
		class: "qty__btn",
		type: "button",
		"aria-label": "Decrease quantity",
		onClick: async () => repaint(await biab.cart.update(it.id, Math.max(0, it.quantity - 1))),
	}, ["−"]);
	const inc = el("button", {
		class: "qty__btn",
		type: "button",
		"aria-label": "Increase quantity",
		onClick: async () => repaint(await biab.cart.update(it.id, it.quantity + 1)),
	}, ["+"]);
	return el("div", { class: "qty" }, [dec, el("span", { class: "qty__n" }, [String(it.quantity)]), inc]);
}

function couponRow(snap, repaint) {
	if (snap.couponCode) {
		return el("div", { class: "coupon coupon--applied" }, [
			el("span", {}, [`Coupon ${snap.couponCode} applied`]),
			el("button", {
				class: "btn btn--ghost btn--sm",
				type: "button",
				onClick: async () => repaint(await biab.cart.removeCoupon()),
			}, ["Remove"]),
		]);
	}
	const input = el("input", { class: "coupon__input", type: "text", placeholder: "Coupon code", "aria-label": "Coupon code" });
	const msg = el("span", { class: "coupon__msg" }, []);
	const apply = el("button", {
		class: "btn btn--ghost btn--sm",
		type: "button",
		onClick: async () => {
			const code = input.value.trim();
			if (!code) return;
			msg.textContent = "Applying…";
			try {
				repaint(await biab.cart.applyCoupon(code));
			} catch (err) {
				msg.textContent = err?.message ?? "Invalid code";
			}
		},
	}, ["Apply"]);
	return el("div", { class: "coupon" }, [input, apply, msg]);
}
