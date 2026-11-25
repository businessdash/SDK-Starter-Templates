// [bd-file:store]
import { dollars, el } from "/bd.js";

/**
 * One line of the cart: photo, name and option, the price each, − and +
 * around the quantity, the line's total, and Remove. `onQuantity(n)` gets
 * the quantity asked for (0 removes the line); `onRemove()` removes it.
 */
export function cartLine(item, currency, { onQuantity, onRemove }) {
	const cur = item.currency ?? currency;
	return el("li", { class: "cart-item" }, [
		item.productImage
			? el("img", { class: "cart-item__img", src: item.productImage, alt: item.productName ?? "" })
			: null,
		el("div", { class: "cart-item__main" }, [
			el("div", { class: "cart-item__name" }, [item.productName ?? "Item"]),
			item.variantTitle ? el("div", { class: "cart-item__variant" }, [item.variantTitle]) : null,
			el("div", { class: "cart-item__price" }, [`${dollars(item.unitPrice, cur)} each`]),
		]),
		el("div", { class: "qty" }, [
			el(
				"button",
				{
					class: "qty__btn",
					type: "button",
					"aria-label": "Decrease quantity",
					onClick: () => onQuantity(Math.max(0, item.quantity - 1)),
				},
				["−"],
			),
			el("span", { class: "qty__n" }, [String(item.quantity)]),
			el(
				"button",
				{
					class: "qty__btn",
					type: "button",
					"aria-label": "Increase quantity",
					onClick: () => onQuantity(item.quantity + 1),
				},
				["+"],
			),
		]),
		el("div", { class: "cart-item__subtotal" }, [dollars(item.subtotal, cur)]),
		el("button", { class: "cart-item__remove", type: "button", "aria-label": "Remove", onClick: () => onRemove() }, [
			"Remove",
		]),
	]);
}
