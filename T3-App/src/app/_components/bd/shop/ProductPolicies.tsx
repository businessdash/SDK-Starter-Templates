// [bd-file:store]
import { BdLink } from "../bd-link";

/** The reassurances under the buy button. */
export function ProductPolicies() {
	return (
		<ul className="policies">
			<li>Secure checkout with Stripe</li>
			<li>
				Questions? <BdLink href="/#contact">Ask us</BdLink> before you buy
			</li>
		</ul>
	);
}
