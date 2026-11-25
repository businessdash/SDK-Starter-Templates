// [bd-file:store]
/** "Only 3 left", at five or fewer. */
export function StockNote({ stock }: { stock: number | null }) {
	const low = stock != null && stock > 0 && stock <= 5;
	return (
		<p class="product-detail__stock" data-bd-stock="" hidden={!low}>
			{low ? `Only ${stock} left` : ""}
		</p>
	);
}
