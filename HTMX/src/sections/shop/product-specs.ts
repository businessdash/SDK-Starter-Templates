// [bd-file:store]
import { html, type Raw } from "../../html";
import type { SpecGroup } from "../../shop/shop";

/** Details: the feature list, then a table per spec group. */
export function productSpecs({ features, specs }: { features: string[]; specs: SpecGroup[] }): Raw {
	if (features.length === 0 && specs.length === 0) return html``;
	return html`<section class="product-section" id="specs">
		<h2 class="product-section__title">Details</h2>
		${features.length > 0 ? html`<ul class="features">${features.map((feature) => html`<li>${feature}</li>`)}</ul>` : ""}
		${specs.map(
			(group) => html`<table class="specs">
				<caption>${group.name}</caption>
				<tbody>${group.rows.map((row) => html`<tr><th scope="row">${row.label}</th><td>${row.value}</td></tr>`)}</tbody>
			</table>`,
		)}
	</section>`;
}
