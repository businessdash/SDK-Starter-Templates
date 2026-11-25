// [bd-file:store]
/**
 * The products picked to compare, from any page, with a link to the table.
 *
 * The element draws what's inside it; `dangerouslySetInnerHTML=""` tells
 * Qwik to leave that alone when the page around it renders again.
 */
export function CompareBar({ storeHref = "/store" }: { storeHref?: string }) {
	return <bd-compare-bar dangerouslySetInnerHTML="" data-store-href={storeHref} />;
}
