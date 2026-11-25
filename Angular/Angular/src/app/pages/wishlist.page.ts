// [bd-file:store]
import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { StoreNavComponent } from "../sections/store-nav.component";

/** Products saved on this device with ♡ Save; `<bd-wishlist>` draws them. */
@Component({
	selector: "bd-wishlist-page",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [StoreNavComponent],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	template: `
		<bd-store-nav />
		<div class="bd-page">
			<div class="bd-section__lead">
				<span class="bd-section__eyebrow">Shop</span>
				<h1 class="bd-section__title">Wishlist</h1>
				<p class="bd-section__sub">Products you saved on this device.</p>
			</div>
			<bd-wishlist data-store-href="/store" />
		</div>
	`,
})
export class WishlistPage {}
