// [bd-file:store]
import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

/** Stars for a rating: the markup the shop's styles and elements use. */
@Component({
	selector: "bd-star-rating",
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: "stars", role: "img", "[attr.aria-label]": "label()" },
	template: `
		@for (step of steps; track step) {
			<span
				class="stars__star"
				[class.stars__star--on]="rating() >= step"
				[class.stars__star--half]="rating() < step && rating() >= step - 0.5"
				>★</span
			>
		}
	`,
})
export class StarRatingComponent {
	readonly rating = input.required<number>();
	readonly steps = [1, 2, 3, 4, 5];
	readonly label = computed(() => `${this.rating().toFixed(1)} out of 5`);
}
