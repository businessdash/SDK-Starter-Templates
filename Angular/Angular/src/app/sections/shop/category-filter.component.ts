// [bd-file:store]
import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

/** All products, then each category with how many products it has. */
@Component({
	selector: "bd-category-filter",
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: ":host { display: contents; }",
	template: `
		@if (categories().length > 0) {
			<div class="store-facet">
				<p class="store-facet__title">Category</p>
				<ul class="store-facet__list">
					<li>
						<button
							class="store-facet__item"
							type="button"
							[attr.aria-pressed]="!selected()"
							[class.store-facet__item--active]="!selected()"
							(click)="select.emit(null)"
						>
							All products
						</button>
					</li>
					@for (c of categories(); track c.id) {
						<li>
							<button
								class="store-facet__item store-facet__item--row"
								type="button"
								[attr.aria-pressed]="selected() === c.id"
								[class.store-facet__item--active]="selected() === c.id"
								(click)="select.emit(selected() === c.id ? null : c.id)"
							>
								<span>{{ c.name }}</span>
								<span class="store-facet__count">{{ c.count }}</span>
							</button>
						</li>
					}
				</ul>
			</div>
		}
	`,
})
export class CategoryFilterComponent {
	readonly categories = input.required<{ id: string; name: string; count: number }[]>();
	readonly selected = input<string | null>(null);
	readonly select = output<string | null>();
}
