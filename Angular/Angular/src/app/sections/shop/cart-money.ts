// [bd-file:store]
/** Cart amounts (line and cart subtotals) are dollars. */
export function cartMoney(amount: number, currency: string): string {
	const value = amount ?? 0;
	try {
		return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(value);
	} catch {
		return `$${value.toFixed(2)}`;
	}
}
