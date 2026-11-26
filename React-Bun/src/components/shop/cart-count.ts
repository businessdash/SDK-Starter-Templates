// [bd-file:store]
/** The window event that carries the cart's item count to the store bar. */
export const CART_EVENT = "bd:cart-count";

/** Tells the store bar the cart's new item count, after a change. */
export function announceCartCount(count: number) {
	window.dispatchEvent(new CustomEvent(CART_EVENT, { detail: count }));
}
