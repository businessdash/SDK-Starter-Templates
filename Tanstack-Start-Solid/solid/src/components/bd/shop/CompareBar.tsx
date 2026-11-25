// [bd-file:store]
/** The products picked to compare, from any page, with a link to the table. */
export function CompareBar(props: { storeHref?: string }) {
	return <bd-compare-bar data-store-href={props.storeHref ?? "/store"} />;
}
