// [bd-file:store]
/** Secure checkout, and a link to ask before buying. */
export function ProductPolicies(props: { contactHref?: string }) {
	return (
		<ul class="policies">
			<li>Secure checkout with Stripe</li>
			<li>
				Questions? <a href={props.contactHref ?? "/#contact"}>Ask us</a> before
				you buy
			</li>
		</ul>
	);
}
