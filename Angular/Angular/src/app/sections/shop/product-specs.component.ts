// [bd-file:store]
import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import type { SpecGroup } from "../../shop/shop";

/** Details: the feature list, then a table per spec group. */
@Component({
	selector: "bd-product-specs",
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: ":host { display: contents; }",
	template: `
		@if (features().length > 0 || specs().length > 0) {
			<section class="product-section" id="specs">
				<h2 class="product-section__title">Details</h2>
				@if (features().length > 0) {
					<ul class="features">
						@for (feature of features(); track feature) {
							<li>{{ feature }}</li>
						}
					</ul>
				}
				@for (group of specs(); track group.name) {
					<table class="specs">
						<caption>{{ group.name }}</caption>
						<tbody>
							@for (row of group.rows; track row.label) {
								<tr>
									<th scope="row">{{ row.label }}</th>
									<td>{{ row.value }}</td>
								</tr>
							}
						</tbody>
					</table>
				}
			</section>
		}
	`,
})
export class ProductSpecsComponent {
	readonly features = input.required<string[]>();
	readonly specs = input.required<SpecGroup[]>();
}
