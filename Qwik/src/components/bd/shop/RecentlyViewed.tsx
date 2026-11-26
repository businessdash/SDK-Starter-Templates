// [bd-file:store]
import type { SavedProduct } from "../../../lib/shop/shop";

/**
 * What this browser opened before, as a rail; this product joins the list
 * for next time. The list lives in this browser, so `<bd-recently-viewed>`
 * draws it.
 *
 * The element draws what's inside it; `dangerouslySetInnerHTML=""` tells
 * Qwik to leave that alone when the page around it renders again.
 */
export function RecentlyViewed({
	product,
	storeHref = "/store",
}: {
	product: SavedProduct;
	storeHref?: string;
}) {
	return (
		<bd-recently-viewed
			dangerouslySetInnerHTML=""
			data-product={JSON.stringify(product)}
			data-store-href={storeHref}
			key={product.id}
		/>
	);
}
