// [bd-file:store]
import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/** Secure checkout, and a link to ask before buying. */
@Component({
	selector: "bd-product-policies",
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: ":host { display: contents; }",
	template: `
		<ul class="policies">
			<li>Secure checkout with Stripe</li>
			<li>Questions? <a [href]="contactHref()">Ask us</a> before you buy</li>
		</ul>
	`,
})
export class ProductPoliciesComponent {
	readonly contactHref = input("/#contact");
}
