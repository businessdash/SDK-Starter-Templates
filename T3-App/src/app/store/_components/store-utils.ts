/**
 * Coercion helpers for the store surface. The SDK types product "extras"
 * (description) as passthrough `unknown` and product-detail variants as
 * `Record<string, unknown>`, so we narrow defensively at the UI edge.
 */

export function asString(v: unknown): string {
	return typeof v === "string" ? v : "";
}

export function asNumber(v: unknown): number | null {
	if (typeof v === "number" && Number.isFinite(v)) return v;
	if (typeof v === "string") {
		const n = Number(v);
		return Number.isFinite(n) ? n : null;
	}
	return null;
}

export function usd(amount: number, currency = "USD"): string {
	try {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency,
		}).format(amount);
	} catch {
		return `$${amount.toFixed(2)}`;
	}
}

export function firstImage(
	images: readonly string[] | null | undefined,
): string | null {
	return images && images.length > 0 ? (images[0] ?? null) : null;
}

/** A product-detail variant, narrowed from the SDK's `Record<string, unknown>`. */
export type StoreVariant = {
	id: string;
	name: string;
	price: number;
	compareAtPrice: number | null;
	stock: number | null;
	isLive: boolean;
};

export function toVariant(raw: Record<string, unknown>): StoreVariant {
	return {
		id: asString(raw.id),
		name: asString(raw.name) || "Default",
		price: asNumber(raw.price) ?? 0,
		compareAtPrice: asNumber(raw.compareAtPrice),
		stock: asNumber(raw.stock),
		isLive: raw.isLive !== false,
	};
}

/** Stock semantics from the demo store: null/negative = unlimited. */
export function inStock(v: StoreVariant): boolean {
	if (v.stock === null) return true;
	return v.stock !== 0;
}
