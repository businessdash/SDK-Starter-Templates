// [bd-file:store]
import type { SavedProduct } from "../../../lib/shop/shop";

/**
 * ♡ Save and ⇄ Compare. The lists live in this browser, so
 * `<bd-save-buttons>` draws them; `compact` leaves just the symbols.
 *
 * The element draws what's inside it; `dangerouslySetInnerHTML=""` tells
 * Qwik to leave that alone when the page around it renders again.
 */
export function SaveButtons({
	product,
	compact = false,
}: {
	product: SavedProduct;
	compact?: boolean;
}) {
	return (
		<bd-save-buttons
			compact={compact || undefined}
			dangerouslySetInnerHTML=""
			data-product={JSON.stringify(product)}
		/>
	);
}
