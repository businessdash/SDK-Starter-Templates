// [bd-file:store]
import type { SavedProduct } from "../../../lib/shop/shop";

/**
 * ♡ Save and ⇄ Compare. The lists live in this browser, so
 * `<bd-save-buttons>` draws them; `compact` leaves just the symbols.
 */
export function SaveButtons(props: {
	product: SavedProduct;
	compact?: boolean;
}) {
	return (
		<bd-save-buttons
			compact={props.compact || undefined}
			data-product={JSON.stringify(props.product)}
		/>
	);
}
