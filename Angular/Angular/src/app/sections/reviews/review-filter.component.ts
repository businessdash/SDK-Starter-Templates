import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { RouterLink } from "@angular/router";
import { type ReviewSource, sourceLabel } from "../../shop/reviews";

/**
 * All, Google, Yelp…: a link per platform the reviews come from
 * (`?source=`). Nothing shows with one platform.
 */
@Component({
	selector: "bd-review-filter",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [RouterLink],
	styles: ":host { display: contents; }",
	template: `
		@if (chips().length > 1) {
			<nav aria-label="Platform">
				<ul class="reviews-filter">
					@for (chip of chips(); track chip.label) {
						<li>
							<a
								[attr.aria-current]="chip.current ? 'true' : 'false'"
								[queryParams]="chip.params"
								[routerLink]="reviewsHref()"
								>{{ chip.label }}</a
							>
						</li>
					}
				</ul>
			</nav>
		}
	`,
})
export class ReviewFilterComponent {
	readonly sources = input.required<ReviewSource[]>();
	readonly source = input<ReviewSource | null>(null);
	readonly reviewsHref = input("/reviews");

	readonly chips = computed(() => {
		const sources = this.sources();
		const source = this.source();
		if (sources.length <= 1) return [];
		return [
			{ label: "All", params: {}, current: !source },
			...sources.map((s) => ({ label: sourceLabel(s), params: { source: s }, current: source === s })),
		];
	});
}
