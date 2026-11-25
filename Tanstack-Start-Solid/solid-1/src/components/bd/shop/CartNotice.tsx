// [bd-file:store]
/** After adding: "Added 2 to your cart." with View cart, or what went wrong. */
export function CartNotice(props: { cartHref: string }) {
	return (
		<div class="product-detail__msg" data-bd-notice hidden role="status">
			<span data-bd-notice-text />
			<a class="bd-btn bd-btn--ghost" data-bd-notice-link href={props.cartHref}>
				View cart
			</a>
		</div>
	);
}
