/** Format integer cents into a localized currency string. */
export function formatMoney(cents: number, currency = "usd"): string {
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency: currency.toUpperCase(),
	}).format(cents / 100);
}

/** Human label for a subscription billing interval. */
export function intervalLabel(interval: string): string {
	return (
		{ day: "day", week: "week", month: "month", year: "year" }[interval] ??
		interval
	);
}

/** Pull a best-effort price (in cents) off a loosely-typed storefront row. */
export function rowPriceCents(row: Record<string, unknown>): number | null {
	const candidates = [
		row.priceCents,
		row.basePriceCents,
		row.amountCents,
		row.price,
	];
	for (const c of candidates) {
		if (typeof c === "number" && Number.isFinite(c)) return c;
	}
	return null;
}

/** First image URL off a loosely-typed storefront row, if any. */
export function rowImage(row: Record<string, unknown>): string | null {
	const images = row.images;
	if (Array.isArray(images) && typeof images[0] === "string") return images[0];
	if (typeof row.imageUrl === "string") return row.imageUrl;
	return null;
}
