import { bd, el } from "../bd.js";

const FALLBACK = [
	{
		id: "f1",
		title: "Standard Service Call",
		description: "Initial visit, diagnosis, and a written estimate.",
		basePrice: 95,
		priceType: "flat",
	},
	{
		id: "f2",
		title: "Tune-up + Inspection",
		description: "Annual maintenance with a 14-point checklist.",
		basePrice: 149,
		priceType: "flat",
	},
	{
		id: "f3",
		title: "Emergency Visit",
		description: "Same-day arrival for urgent issues.",
		basePrice: 225,
		priceType: "starting",
	},
];

function formatPrice(s) {
	if (typeof s.basePrice !== "number") return "Quote on request";
	const prefix = s.priceType === "starting" ? "From " : "";
	return `${prefix}$${s.basePrice}`;
}

function card(service) {
	return el("article", { class: "bd-card service-card" }, [
		el("h3", {}, [service.title]),
		el("p", {}, [service.description]),
		el("div", { class: "service-card__price" }, [formatPrice(service)]),
	]);
}

/** @param {HTMLElement} target */
export async function renderServices(target) {
	function paint(items) {
		target.replaceChildren(
			el("div", { class: "bd-section__lead" }, [
				el("span", { class: "bd-section__eyebrow" }, ["What we do"]),
				el("h2", { class: "bd-section__title" }, ["Services"]),
				el("p", { class: "bd-section__sub" }, [
					"Clear scope, clear price. Add-ons quoted before any work starts.",
				]),
			]),
			el(
				"div",
				{ class: "bd-grid-3" },
				items.map(card),
			),
		);
	}

	paint(FALLBACK);

	try {
		const bundle = await bd.marketing.getPageBundle({ pageKey: "home" });
		const raw = bundle?.sections?.services;
		const list = raw?.ok ? raw.data?.items : null;
		if (Array.isArray(list) && list.length > 0) paint(list);
	} catch {
		// stay on fallback
	}
}
