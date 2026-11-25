// [bd-file:store]
/** "Only 3 left", when five or fewer are left. */
export function StockNote({ stock }: { stock: number | null }) {
	if (stock == null || stock <= 0 || stock > 5) return null;
	return <p className="product-detail__stock">Only {stock} left</p>;
}
