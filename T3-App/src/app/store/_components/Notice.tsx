/** A small inline notice — used by the store surface to explain "not
 *  connected" / "no items" / "failed" states instead of an empty grid. */
export function Notice({ title, body }: { title: string; body: string }) {
	return (
		<div className="bd-notice">
			<h2>{title}</h2>
			<p>{body}</p>
		</div>
	);
}
