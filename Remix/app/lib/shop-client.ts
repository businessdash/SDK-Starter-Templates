// [bd-file:store]
import type {
	AddToCartInput,
	AddToCartResult,
} from "~/components/shop/ProductDetail";

/** Add to cart through `/api/store/cart`, for the shared product page. */
export async function addToCartClient(
	input: AddToCartInput,
): Promise<AddToCartResult> {
	try {
		const res = await fetch("/api/store/cart", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(input),
		});
		const data = (await res.json()) as AddToCartResult;
		return data.ok || "error" in data
			? data
			: { ok: false, error: "Couldn't add that. Try again." };
	} catch {
		return { ok: false, error: "Couldn't reach the store. Try again." };
	}
}
