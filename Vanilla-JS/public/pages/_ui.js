/** Shared bits for the feature page modules. */
import { el } from "/biab.js";

/** A friendly error/unavailable box. Detects the suspension 503 shape. */
export function errBox(err) {
	const msg = String((err && err.message) || err || "");
	const unavailable = /unavailable|\b503\b/.test(msg);
	const notConfigured = /not configured|\b503\b/.test(msg) && !/unavailable/.test(msg);
	return el("div", { class: "page__error" }, [
		unavailable
			? "This site is temporarily unavailable. Please check back soon."
			: notConfigured
				? "BIAB isn't configured on this server yet — set the env vars in .env.local (see .env.example)."
				: "Couldn't load this section.",
	]);
}

/** Page heading + optional subtitle. */
export function pageHead(title, sub) {
	return el("header", { class: "page__head" }, [
		el("h1", { class: "page__title" }, [title]),
		sub ? el("p", { class: "page__sub" }, [sub]) : null,
	]);
}
