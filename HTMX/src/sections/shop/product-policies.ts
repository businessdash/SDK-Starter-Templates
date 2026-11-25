// [bd-file:store]
import { html, type Raw } from "../../html";

/** Secure checkout, and a link to ask before buying. */
export function productPolicies({ contactHref = "/#contact" } = {}): Raw {
	return html`<ul class="policies">
		<li>Secure checkout with Stripe</li>
		<li>Questions? <a href="${contactHref}">Ask us</a> before you buy</li>
	</ul>`;
}
