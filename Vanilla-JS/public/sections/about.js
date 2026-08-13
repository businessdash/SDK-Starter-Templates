import { biab, el } from "../biab.js";
import { renderSubscribe } from "./subscribe.js";

/** @param {HTMLElement} target */
export async function renderAbout(target) {
	const fallback =
		"We're a small team that takes pride in being available. Real schedule, real reviews, real follow-up — no automated runaround. Book a slot below or send us a note and we'll get right back to you.";

	// Newsletter signup lives at the foot of About (and again in the footer) —
	// one shared component (subscribe.js) used in two places, like DGP.
	const subscribe = el("div", { class: "subscribe subscribe--about" });
	renderSubscribe(subscribe, {
		label: "Like what you see? Get our updates.",
		source: "about",
		idPrefix: "about-subscribe",
	}).catch((err) => console.error("[biab] about subscribe failed", err));

	function paint(body) {
		target.replaceChildren(
			el("div", { class: "biab-section__lead" }, [
				el("span", { class: "biab-section__eyebrow" }, ["About"]),
				el("h2", { class: "biab-section__title" }, [
					"Built around how you actually work.",
				]),
			]),
			el(
				"p",
				{
					style:
						"color: var(--text); font-size: 1.05rem; text-align: center;",
				},
				[body],
			),
			subscribe,
		);
	}

	paint(fallback);

	try {
		const bundle = await biab.marketing.getPageBundle({ pageKey: "home" });
		const raw = bundle?.sections?.about;
		if (raw?.ok && typeof raw.data?.body === "string") paint(raw.data.body);
	} catch {
		// stay on fallback
	}
}
