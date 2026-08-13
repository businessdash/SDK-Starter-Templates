/**
 * Pure display helpers — safe in both server and client bundles (no `.server`
 * suffix, no SDK/secret imports). The cart component uses `formatCents`
 * directly, so it can't live in a server-only module.
 */

export function formatCents(cents: number, currency = "usd"): string {
	try {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: currency.toUpperCase(),
		}).format(cents / 100);
	} catch {
		return `$${(cents / 100).toFixed(2)}`;
	}
}
