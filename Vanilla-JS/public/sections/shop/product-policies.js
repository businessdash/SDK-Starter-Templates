// [bd-file:store]
import { el } from "/bd.js";

/** Secure checkout, and a link to ask before buying. */
export function productPolicies({ contactHref = "/#contact" } = {}) {
	return el("ul", { class: "policies" }, [
		el("li", {}, ["Secure checkout with Stripe"]),
		el("li", {}, ["Questions? ", el("a", { href: contactHref }, ["Ask us"]), " before you buy"]),
	]);
}
