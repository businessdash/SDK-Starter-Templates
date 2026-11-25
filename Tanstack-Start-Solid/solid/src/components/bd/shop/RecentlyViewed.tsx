// [bd-file:store]
import type { SavedProduct } from "../../../lib/shop/shop";

/**
 * What this browser opened before, as a rail; this product joins the list
 * for next time. The list lives in this browser, so `<bd-recently-viewed>`
 * draws it.
 */
export function RecentlyViewed(props: {
	product: SavedProduct;
	storeHref?: string;
}) {
	return (
		<bd-recently-viewed
			data-product={JSON.stringify(props.product)}
			data-store-href={props.storeHref ?? "/store"}
		/>
	);
}
