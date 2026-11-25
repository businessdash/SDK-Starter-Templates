// [bd-file:store]
/** "Only 3 left", at five or fewer. */
export function StockNote(props: { stock: number | null }) {
	const low = () =>
		props.stock != null && props.stock > 0 && props.stock <= 5;
	return (
		<p class="product-detail__stock" data-bd-stock hidden={!low()}>
			{low() ? `Only ${props.stock} left` : ""}
		</p>
	);
}
