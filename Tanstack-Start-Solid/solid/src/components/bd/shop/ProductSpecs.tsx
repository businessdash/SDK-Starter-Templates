// [bd-file:store]
import { For, Show } from "solid-js";

import type { SpecGroup } from "../../../lib/shop/shop";

/** Details: the feature list, then a table per spec group. */
export function ProductSpecs(props: { features: string[]; specs: SpecGroup[] }) {
	return (
		<Show when={props.features.length > 0 || props.specs.length > 0}>
			<section class="product-section" id="specs">
				<h2 class="product-section__title">Details</h2>
				<Show when={props.features.length > 0}>
					<ul class="features">
						<For each={props.features}>{(feature) => <li>{feature}</li>}</For>
					</ul>
				</Show>
				<For each={props.specs}>
					{(group) => (
						<table class="specs">
							<caption>{group.name}</caption>
							<tbody>
								<For each={group.rows}>
									{(row) => (
										<tr>
											<th scope="row">{row.label}</th>
											<td>{row.value}</td>
										</tr>
									)}
								</For>
							</tbody>
						</table>
					)}
				</For>
			</section>
		</Show>
	);
}
