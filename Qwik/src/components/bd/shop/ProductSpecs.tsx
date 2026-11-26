// [bd-file:store]
import type { SpecGroup } from "../../../lib/shop/shop";

/** Details: the feature list, then a table per spec group. */
export function ProductSpecs({
	features,
	specs,
}: {
	features: string[];
	specs: SpecGroup[];
}) {
	if (features.length === 0 && specs.length === 0) return null;
	return (
		<section class="product-section" id="specs">
			<h2 class="product-section__title">Details</h2>
			{features.length > 0 ? (
				<ul class="features">
					{features.map((feature) => (
						<li key={feature}>{feature}</li>
					))}
				</ul>
			) : null}
			{specs.map((group) => (
				<table class="specs" key={group.name}>
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
