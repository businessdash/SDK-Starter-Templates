// [bd-file:store]
/** Clear cart and Checkout, and what checkout is doing ("Starting checkout…"). */
export function CartActions({
	status,
	onClear,
	onCheckout,
}: {
	status: string;
	onClear: () => void;
	onCheckout: () => void;
}) {
	return (
		<>
			<div className="cart-actions">
				<button className="btn btn--ghost" type="button" onClick={onClear}>
					Clear cart
				</button>
				<button className="btn btn--primary btn--lg" type="button" onClick={onCheckout}>
					Checkout
				</button>
			</div>
			<p className="cart-checkout__status">{status}</p>
		</>
	);
}
