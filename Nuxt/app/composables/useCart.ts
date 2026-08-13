import { ref } from "vue";
import type { CartSnapshot } from "@businessdash/sdk/contracts";

type CartActionResult =
	| { ok: true; cart: CartSnapshot }
	| { ok: false; error: string };

/**
 * Tiny client-side cart helper. Every mutation posts to a Nitro
 * endpoint (the SDK + API key stay server-side) and swaps in the
 * returned snapshot. Shared by the product detail and cart pages.
 *
 * `cart` is the latest snapshot (null until loaded / when empty).
 */
export function useCart() {
	const cart = ref<CartSnapshot | null>(null);
	const error = ref<string | null>(null);
	const busy = ref(false);

	async function load() {
		const res = await $fetch<{ cart: CartSnapshot | null }>("/api/biab/cart");
		cart.value = res.cart;
	}

	async function mutate(
		path: string,
		body: Record<string, unknown>,
	): Promise<boolean> {
		busy.value = true;
		error.value = null;
		try {
			const res = await $fetch<CartActionResult>(path, { method: "POST", body });
			if (res.ok) {
				cart.value = res.cart;
				return true;
			}
			error.value = res.error;
			return false;
		} catch (err) {
			error.value = err instanceof Error ? err.message : "Something went wrong.";
			return false;
		} finally {
			busy.value = false;
		}
	}

	const addItem = (input: {
		productId: string;
		variantId?: string | null;
		quantity?: number;
	}) => mutate("/api/biab/cart/add", input);
	const updateItem = (itemId: string, quantity: number) =>
		mutate("/api/biab/cart/update", { itemId, quantity });
	const removeItem = (itemId: string) =>
		mutate("/api/biab/cart/remove", { itemId });
	const applyCoupon = (code: string) =>
		mutate("/api/biab/cart/coupon", { code });
	const removeCoupon = () => mutate("/api/biab/cart/coupon", { code: "" });
	const clear = () => mutate("/api/biab/cart/clear", {});

	return {
		cart,
		error,
		busy,
		load,
		addItem,
		updateItem,
		removeItem,
		applyCoupon,
		removeCoupon,
		clear,
	};
}

/** Format an integer cent amount as currency for display. */
export function formatMoney(cents: number, currency = "USD"): string {
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency,
	}).format(cents / 100);
}
