// [bd-file:store]
import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { StarRatingComponent } from "../star-rating.component";

/** 4, 3 or 2 stars & up; 0 when none is chosen. */
@Component({
	selector: "bd-rating-filter",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [StarRatingComponent],
	styles: ":host { display: contents; }",
	template: `
		<div class="store-facet">
			<p class="store-facet__title">Rating</p>
			<ul class="store-facet__list">
				@for (r of steps; track r) {
					<li>
						<button
							class="store-facet__item store-facet__rating"
							type="button"
							[attr.aria-pressed]="selected() === r"
							[class.store-facet__item--active]="selected() === r"
							(click)="select.emit(selected() === r ? 0 : r)"
						>
							<bd-star-rating [rating]="r" />
							<span class="store-facet__count">&amp; up</span>
						</button>
					</li>
				}
			</ul>
		</div>
	`,
})
export class RatingFilterComponent {
	readonly selected = input(0);
	readonly select = output<number>();
	readonly steps = [4, 3, 2];
}
