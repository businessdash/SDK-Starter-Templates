// [bd-file:store]
import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { RouterLink } from "@angular/router";
import type { ProductView } from "../../shop/shop";

/** Store / Category / This product. */
@Component({
	selector: "bd-product-breadcrumbs",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [RouterLink],
	styles: ":host { display: contents; }",
	template: `
		<nav aria-label="Breadcrumb" class="crumbs">
			<a [routerLink]="storeHref()">Store</a>
			@if (product().categoryId; as categoryId) {
				<span aria-hidden="true">/</span>
				<a [routerLink]="storeHref()" [queryParams]="{ category: categoryId }">{{
					product().categoryName ?? "Category"
				}}</a>
			}
			<span aria-hidden="true">/</span>
			<span aria-current="page">{{ product().name }}</span>
		</nav>
	`,
})
export class ProductBreadcrumbsComponent {
	readonly product = input.required<ProductView>();
	readonly storeHref = input("/store");
}
