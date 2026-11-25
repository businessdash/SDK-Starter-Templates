// [bd-file:store]
/** Cart amounts (unit prices, line and cart subtotals) are dollars, not cents. */
export function cartMoney(dollars: number, currency = "USD"): string {
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency: currency.toUpperCase(),
	}).format(dollars);
}
