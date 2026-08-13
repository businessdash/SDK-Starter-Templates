/**
 * News banner — renders the (schedule-aware) `bundle.banner` message into a
 * dismissible bar. `bundle.banner` is an untyped passthrough at SDK 0.9.5, so
 * we read it defensively: it may be `{ enabled, message, link, linkText }` or
 * `{ messages: [{ text, link, linkText, displayFromUtc, displayUntilUtc }] }`.
 */

import { biab, el } from "/biab.js";

const DISMISS_KEY = "biab-banner-dismissed";

export async function mountBanner(root) {
	if (!root) return;
	let extras;
	try {
		extras = await biab.content.extras();
	} catch {
		return; // unconfigured / unavailable → no banner
	}
	const msg = pickMessage(extras?.banner);
	if (!msg) return;
	try {
		if (sessionStorage.getItem(DISMISS_KEY) === msg.id) return;
	} catch {
		/* ignore storage failures */
	}

	const bar = el("div", { class: "newsbanner", role: "region", "aria-label": "Announcement" }, [
		el("span", { class: "newsbanner__text" }, [msg.text]),
		msg.link ? el("a", { class: "newsbanner__link", href: msg.link }, [msg.linkText || "Learn more"]) : null,
		el(
			"button",
			{
				class: "newsbanner__close",
				type: "button",
				"aria-label": "Dismiss announcement",
				onClick: () => {
					try {
						sessionStorage.setItem(DISMISS_KEY, msg.id);
					} catch {
						/* ignore */
					}
					bar.remove();
				},
			},
			["×"],
		),
	]);
	root.append(bar);
}

function pickMessage(banner) {
	if (!banner || banner.enabled === false) return null;
	const list = Array.isArray(banner.messages)
		? banner.messages
		: banner.message || banner.text
			? [banner]
			: [];
	const now = Date.now();
	for (const m of list) {
		const from = m.displayFromUtc ? Date.parse(m.displayFromUtc) : null;
		const until = m.displayUntilUtc ? Date.parse(m.displayUntilUtc) : null;
		if (from && from > now) continue;
		if (until && until < now) continue;
		const text = m.text ?? m.message;
		if (!text) continue;
		return {
			id: String(m.id ?? text).slice(0, 48),
			text,
			link: m.link ?? null,
			linkText: m.linkText ?? m.buttonText ?? null,
		};
	}
	return null;
}
