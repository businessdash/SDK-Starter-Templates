/** /subscriptions — recurring plans from `biab.subscriptions.list`. */
import { biab, el, money } from "/biab.js";
import { errBox, pageHead } from "./_ui.js";

export default async function render(root) {
	root.replaceChildren(pageHead("Plans", "Recurring subscriptions, billed via Stripe."));
	try {
		const res = await biab.subscriptions.list();
		const items = res?.items ?? [];
		if (!items.length) {
			root.append(el("p", { class: "muted" }, ["No subscription plans yet."]));
			return;
		}
		root.append(el("div", { class: "plan-grid" }, items.map(planCard)));
	} catch (err) {
		root.append(errBox(err));
	}
}

function planCard(p) {
	return el("div", { class: "plan-card" }, [
		p.imageUrl ? el("img", { class: "plan-card__img", src: p.imageUrl, alt: p.name }) : null,
		el("h3", { class: "plan-card__name" }, [p.name ?? "Plan"]),
		p.description ? el("p", { class: "plan-card__desc" }, [p.description]) : null,
		el("div", { class: "plan-card__price" }, [
			money(p.amountCents, p.currency),
			el("span", { class: "plan-card__interval" }, [` / ${p.interval ?? "month"}`]),
		]),
	]);
}
