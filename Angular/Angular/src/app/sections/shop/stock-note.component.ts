// [bd-file:store]
import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

/** "Only 3 left", at five or fewer. */
@Component({
	selector: "bd-stock-note",
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: ":host { display: contents; }",
	template: `<p class="product-detail__stock" data-bd-stock [hidden]="!low()">{{ low() ? "Only " + stock() + " left" : "" }}</p>`,
})
export class StockNoteComponent {
	readonly stock = input.required<number | null>();
	readonly low = computed(() => {
		const stock = this.stock();
		return stock != null && stock > 0 && stock <= 5;
	});
}
