// [bd-file:store]
import { html, type Raw } from "../../html";
import { dollars } from "../../layout";

/** A cart line as the SDK returns it; amounts are dollars. */
export type CartLineItem = {
	id: string;
	productName?: string | null;
	productImage?: string | null;
	variantTitle?: string | null;
	quantity: number;
	unitPrice: number;
	subtotal: number;
	currency?: string | null;
};

/**
 * One line of the cart: photo, name and option, the price each, − and +
 * around the quantity, the line's total, and Remove. htmx posts each change
 * (/cart/update, /cart/remove) and swaps the cart (#cart-region) back in.
 */
export function cartLine(item: CartLineItem, currency: string): Raw {
	const dec = JSON.stringify({ itemId: item.id, quantity: Math.max(0, item.quantity - 1) });
	const inc = JSON.stringify({ itemId: item.id, quantity: item.quantity + 1 });
	const rm = JSON.stringify({ itemId: item.id });
	const cur = item.currency ?? currency;
	return html`<li class="cart-item">
		${item.productImage ? html`<img class="cart-item__img" src="${item.productImage}" alt="${item.productName ?? ""}" />` : ""}
		<div class="cart-item__main">
			<div class="cart-item__name">${item.productName ?? "Item"}</div>
			${item.variantTitle ? html`<div class="cart-item__variant">${item.variantTitle}</div>` : ""}
			<div class="cart-item__price">${dollars(item.unitPrice, cur)} each</div>
		</div>
		<div class="cart-qty">
			<button class="cart-qty__btn" type="button" aria-label="Decrease" hx-post="/cart/update" hx-vals="${dec}" hx-target="#cart-region" hx-swap="outerHTML">−</button>
			<span class="cart-qty__n">${String(item.quantity)}</span>
			<button class="cart-qty__btn" type="button" aria-label="Increase" hx-post="/cart/update" hx-vals="${inc}" hx-target="#cart-region" hx-swap="outerHTML">+</button>
		</div>
		<div class="cart-item__subtotal">${dollars(item.subtotal, cur)}</div>
		<button class="cart-item__remove" type="button" hx-post="/cart/remove" hx-vals="${rm}" hx-target="#cart-region" hx-swap="outerHTML">Remove</button>
	</li>`;
}
