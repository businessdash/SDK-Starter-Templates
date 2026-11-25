// [bd-file:store,subscriptions]
/**
 * Money for the cart and order pages (the order page also confirms plans).
 * Their amounts are dollars, not cents.
 */
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
