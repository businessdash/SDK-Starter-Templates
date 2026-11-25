// [bd-file:subscriptions]
/** /subscriptions — recurring plans from `bd.subscriptions.list`. */
import { bd, el, money } from "/bd.js";
import { errBox, pageHead } from "./_ui.js";
import { mountStoreNav } from "./_store-nav.js";

const SIGN_IN = "/my-account?next=/subscriptions";

export default async function render(root) {
	mountStoreNav();
	root.replaceChildren(pageHead("Plans", "Recurring subscriptions, billed via Stripe."));
	// Stripe sends the customer back with the checkout session id.
	if (new URLSearchParams(location.search).has("session_id")) {
		root.append(
			el("p", { class: "muted" }, [
				"Thanks for subscribing. Your plan is in ",
				el("a", { href: "/my-account" }, ["your account"]),
				".",
			]),
		);
	}
	try {
		const res = await bd.subscriptions.list();
		const items = res?.items ?? [];
		if (!items.length) {
			root.append(el("p", { class: "muted" }, ["No subscription plans yet."]));
			return;
		}
		const msg = el("p", { class: "rf__msg" }, []);
		root.append(
			el(
				"div",
				{ class: "plan-grid" },
				items.map((p) => planCard(p, res?.signedIn === true, msg)),
			),
			msg,
		);
	} catch (err) {
		root.append(errBox(err));
	}
}

/** A plan is the signed-in customer's own; anyone else signs in first. */
function subscribeButton(p, msg) {
	const btn = el(
		"button",
		{
			class: "btn btn--primary",
			type: "button",
			onClick: async () => {
				btn.disabled = true;
				btn.textContent = "Working…";
				msg.textContent = "";
				try {
					const res = await bd.subscriptions.checkout(p.id);
					location.href = res?.url ?? res?.signIn ?? SIGN_IN;
				} catch (err) {
					msg.textContent = err?.message ?? "Couldn't start checkout.";
					btn.disabled = false;
					btn.textContent = "Subscribe";
				}
			},
		},
		["Subscribe"],
	);
	return btn;
}

function planCard(p, signedIn, msg) {
	return el("div", { class: "plan-card" }, [
		p.imageUrl ? el("img", { class: "plan-card__img", src: p.imageUrl, alt: p.name }) : null,
		el("h3", { class: "plan-card__name" }, [p.name ?? "Plan"]),
		p.description ? el("p", { class: "plan-card__desc" }, [p.description]) : null,
		el("div", { class: "plan-card__price" }, [
			money(p.amountCents, p.currency),
			el("span", { class: "plan-card__interval" }, [` / ${p.interval ?? "month"}`]),
		]),
		signedIn
			? subscribeButton(p, msg)
			: el("a", { class: "btn btn--primary", href: SIGN_IN }, ["Sign in to subscribe"]),
	]);
}
