// [bd-file:store]
import type { SpecGroup } from "./shop";

/** Details: the feature list and a table per spec group. */
export function ProductSpecs({
	features,
	specs,
}: {
	features: string[];
	specs: SpecGroup[];
}) {
	if (features.length === 0 && specs.length === 0) return null;
	return (
		<section className="product-section" id="specs">
			<h2 className="product-section__title">Details</h2>
			{features.length > 0 && (
				<ul className="features">
					{features.map((feature) => (
						<li key={feature}>{feature}</li>
					))}
				</ul>
			)}
			{specs.map((group) => (
				<table className="specs" key={group.name}>
					<caption>{group.name}</caption>
					<tbody>
						{group.rows.map((row) => (
							<tr key={row.label}>
								<th scope="row">{row.label}</th>
								<td>{row.value}</td>
							</tr>
						))}
					</tbody>
				</table>
			))}
		</section>
	);
}
