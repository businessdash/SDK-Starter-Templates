import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from "@angular/core";
import { RouterLink } from "@angular/router";
import { BiabService } from "../lib/biab.service";

/**
 * Home-page reviews teaser: aggregate (average + count) plus a link to the
 * full wall at /reviews. Aggregate comes from the marketing bundle's
 * `reviews` block (no extra request). Hidden when there are no reviews.
 */
@Component({
	selector: "biab-reviews-summary",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [RouterLink],
	template: `
		@if (aggregate(); as agg) {
			<section class="section" id="reviews">
				<h2 class="section__title">What customers say</h2>
				<p class="reviews-agg">
					<strong>{{ agg.rating }}</strong> average · {{ agg.count }} reviews
				</p>
				<a class="biab-btn" routerLink="/reviews">Read all reviews</a>
			</section>
		}
	`,
})
export class ReviewsSummaryComponent implements OnInit {
	readonly svc = inject(BiabService);

	readonly aggregate = computed(() => {
		const agg = this.svc.reviewsAggregate();
		if (!agg || agg.totalCount == null || agg.totalCount === 0) return null;
		return {
			rating: agg.rating != null ? agg.rating.toFixed(1) : "—",
			count: agg.totalCount,
		};
	});

	ngOnInit() {
		void this.svc.loadHome();
	}
}
