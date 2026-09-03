/**
 * Newsletter subscribe — wired to BD followers via a browser-safe PUBLISHABLE
 * token (`pk_…`, origin-locked, `followers:self` scope). No backend round-trip:
 * the browser calls `createBdClient(...).followers.join(...)` directly.
 *
 * One shared renderer powers BOTH the footer and the about-section signups (the
 * vanilla analogue of DGP's single <SubscribeStub> used in two places).
 *
 * Live vs placeholder split (graceful fallback):
 *   - Configured  (window.__BD_PUBLIC__.pk + .siteId) → live signup.
 *   - Unconfigured                                       → "coming soon" stub
 *     with the same fields, so an unconfigured checkout still renders.
 *
 * Anonymous "already subscribed" hint: after a successful join we persist
 * `{ email, at }` in localStorage under `bd.followers.<siteId>` and read it on
 * mount to show "You're subscribed" instead of the form — mirroring exactly what
 * the React `useFollowers` hook does internally. (Logged-in/cross-device truth
 * is `followers.me(email)`; IP is deliberately never used.)
 */

import { el } from "../bd.js";

/** Per-browser follower store, keyed by site (same key the React hook uses). */
const FOLLOWER_STORE_PREFIX = "bd.followers.";

function readLocalFollow(siteId) {
	try {
		const raw = localStorage.getItem(`${FOLLOWER_STORE_PREFIX}${siteId}`);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		return typeof parsed?.email === "string"
			? { email: parsed.email, at: Number(parsed.at) || 0 }
			: null;
	} catch {
		return null;
	}
}

function writeLocalFollow(siteId, entry) {
	try {
		localStorage.setItem(`${FOLLOWER_STORE_PREFIX}${siteId}`, JSON.stringify(entry));
	} catch {
		// storage disabled / quota — the local hint is best-effort.
	}
}

/** Browser-exposed publishable config injected by the server (server.ts). */
function publicConfig() {
	return (typeof window !== "undefined" && window.__BD_PUBLIC__) || null;
}

/** Shared input + button markup (identical look in both live + placeholder). */
function subscribeFields({ label, placeholder, buttonLabel, idPrefix, onSubmit }) {
	const input = el("input", {
		class: "subscribe__input",
		id: `${idPrefix}-email`,
		name: "email",
		type: "email",
		// Browsers offer autofill from a recognized token — same default the SDK
		// form applies to its own email fields.
		autocomplete: "email",
		placeholder: placeholder ?? "you@example.com",
		required: true,
	});
	const button = el("button", { class: "subscribe__btn", type: "submit" }, [
		buttonLabel ?? "Subscribe",
	]);
	const msg = el("p", { class: "subscribe__msg" }, []);
	const form = el(
		"form",
		{
			class: "subscribe__form",
			onSubmit: (event) => onSubmit(event, { input, button, msg }),
		},
		[
			el("label", { class: "subscribe__label", for: `${idPrefix}-email` }, [label]),
			el("div", { class: "subscribe__row" }, [input, button]),
			msg,
		],
	);
	return form;
}

/** "You're subscribed" terminal state (shared). */
function subscribedNotice() {
	return el("p", { class: "subscribe__done" }, ["You're subscribed — thanks!"]);
}

/**
 * Render the subscribe section into `target`.
 * @param {HTMLElement} target
 * @param {{ label?: string; placeholder?: string; buttonLabel?: string;
 *   source?: string; idPrefix?: string }} [opts]
 */
export async function renderSubscribe(target, opts = {}) {
	const label = opts.label ?? "Get updates & offers in your inbox.";
	const placeholder = opts.placeholder;
	const buttonLabel = opts.buttonLabel;
	const source = opts.source ?? "subscribe";
	const idPrefix = opts.idPrefix ?? "subscribe";

	const cfg = publicConfig();
	const enabled = Boolean(cfg && cfg.pk && cfg.siteId);

	// Live: this browser already subscribed → skip the form (anonymous hint).
	if (enabled && readLocalFollow(cfg.siteId)) {
		target.replaceChildren(subscribedNotice());
		return;
	}

	if (!enabled) {
		// Placeholder: same fields, but submit just shows "coming soon".
		const form = subscribeFields({
			label,
			placeholder,
			buttonLabel,
			idPrefix,
			onSubmit: (event, { msg }) => {
				event.preventDefault();
				msg.textContent = "Newsletter signup is coming soon.";
			},
		});
		target.replaceChildren(form);
		return;
	}

	// Live: browser-safe publishable client (no backend). Lazy-import the SDK so
	// the placeholder path stays zero-dependency.
	const { createBdClient } = await import("@businessdash/sdk");
	const client = createBdClient({
		apiKey: cfg.pk,
		siteId: cfg.siteId,
		...(cfg.baseUrl ? { baseUrl: cfg.baseUrl } : {}),
	});

	const form = subscribeFields({
		label,
		placeholder,
		buttonLabel,
		idPrefix,
		onSubmit: async (event, { button, msg }) => {
			event.preventDefault();
			const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
			if (!email) return;
			button.disabled = true;
			msg.textContent = "Subscribing…";
			msg.className = "subscribe__msg";
			try {
				await client.followers.join({ email, source });
				writeLocalFollow(cfg.siteId, { email, at: Date.now() });
				target.replaceChildren(subscribedNotice());
			} catch {
				button.disabled = false;
				msg.textContent = "Couldn't subscribe — please try again.";
				msg.className = "subscribe__msg subscribe__msg--error";
			}
		},
	});
	target.replaceChildren(form);
}
