// [bd-file:store]
import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/** After adding: "Added 2 to your cart." with View cart, or what went wrong. */
@Component({
	selector: "bd-cart-notice",
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: ":host { display: contents; }",
	template: `
		<div class="product-detail__msg" data-bd-notice hidden role="status">
			<span data-bd-notice-text></span>
			<a class="bd-btn bd-btn--ghost" data-bd-notice-link [href]="cartHref()">View cart</a>
		</div>
	`,
})
export class CartNoticeComponent {
	readonly cartHref = input.required<string>();
}
