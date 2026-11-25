// [bd-file:store]
import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import type { StorefrontProductReviewsResponse } from "@businessdash/sdk/contracts";
import type { ProductView } from "../../shop/shop";
import { StarRatingComponent } from "../star-rating.component";

/** The category, the name, and the stars linking to the reviews. */
@Component({
	selector: "bd-product-title",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [StarRatingComponent],
	styles: ":host { display: contents; }",
	template: `
		<div>
			@if (product().categoryName; as category) {
				<p class="product-detail__eyebrow">{{ category }}</p>
			}
			<h1>{{ product().name }}</h1>
			@if (reviews(); as r) {
				@if (r.totalCount > 0) {
					<a class="product-detail__rating" href="#reviews">
						<bd-star-rating [rating]="r.avgRating" />
						<span>{{ r.avgRating.toFixed(1) }} · {{ r.totalCount }} reviews</span>
					</a>
				}
			}
		</div>
	`,
})
export class ProductTitleComponent {
	readonly product = input.required<ProductView>();
	readonly reviews = input.required<StorefrontProductReviewsResponse | null>();
}
