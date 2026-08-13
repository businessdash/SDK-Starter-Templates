import { el } from "../biab.js";

/**
 * Contact section — now a drop-in `<biab-form>` web component.
 *
 * Before, this file hand-rolled the whole form (field loop, submit, error
 * handling). The SDK now ships that as a binding: `@businessdash/sdk/element`
 * registers a `<biab-form slug="…">` custom element that fetches the schema,
 * renders every field type, applies the form's settings (multi-step, progress,
 * animation, org icon), validates, and submits — all in light DOM with the
 * `biab-*` classes this template already styles. We write design + a slug; the
 * SDK owns the rest.
 *
 * The element needs a `BiabClient` to load + submit. The browser must never see
 * the bearer key, so we hand it a tiny PROXY client whose `forms` resource hits
 * this template's same-origin `/api/biab/forms/*` endpoints (see server.ts).
 * `setBiabFormClient(...)` registers it as the default for every <biab-form> on
 * the page — the web-component analogue of a React <BiabFormProvider>.
 *
 * Replace `FORM_SLUG` with the form you authored in BIAB → Forms.
 */
const FORM_SLUG = "general-inquiry";

/**
 * A minimal same-origin proxy that satisfies the `forms` slice of `BiabClient`
 * the binding uses (`forms.schema` / `forms.submit` / `forms.uploadFile`).
 * Every call is same-origin `/api/biab/*`; the Bun server holds the bearer key.
 */
function createProxyFormsClient() {
	return {
		forms: {
			async schema(slug) {
				const res = await fetch(
					`/api/biab/forms/schema?slug=${encodeURIComponent(slug)}`,
				);
				if (!res.ok) {
					const text = await res.text().catch(() => "");
					throw new Error(`BIAB forms.schema ${res.status}: ${text.slice(0, 200)}`);
				}
				return await res.json();
			},
			async submit(slug, data, opts = {}) {
				const res = await fetch("/api/biab/forms/submit", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						slug,
						data,
						submitterEmail: opts.submitterEmail,
						submitterName: opts.submitterName,
					}),
				});
				// The binding expects forms.submit to RESOLVE (never throw) with a
				// FormSubmitResult discriminated by `ok`. The server already returns
				// that exact shape (biab.forms.submit resolves a result, even on a
				// validation failure), so pass it straight through when present.
				const body = await res.json().catch(() => null);
				if (body && typeof body.ok === "boolean") return body;
				if (res.ok) return { ok: true, status: res.status, ...(body ?? {}) };
				return {
					ok: false,
					status: res.status,
					reason: "server_error",
					message: body?.error ?? `Submission failed (${res.status}).`,
				};
			},
			async uploadFile() {
				// Wire a /api/biab/forms/upload-url proxy + R2 PUT to enable file
				// fields. Not needed for the contact form, so left unimplemented.
				throw new Error("File uploads are not wired in this starter's proxy.");
			},
		},
	};
}

/** @param {HTMLElement} target */
export async function renderContactForm(target) {
	const lead = el("div", { class: "biab-section__lead" }, [
		el("span", { class: "biab-section__eyebrow" }, ["Contact"]),
		el("h2", { class: "biab-section__title" }, ["Get in touch"]),
		el("p", { class: "biab-section__sub" }, [
			"We'll get back within one business day.",
		]),
	]);

	// Register the binding + its same-origin proxy client (idempotent — every
	// section that drops a <biab-form> shares this one default client).
	const { setBiabFormClient } = await import("@businessdash/sdk/element");
	setBiabFormClient(createProxyFormsClient());

	// The drop-in. `slug` + `submit-label` are all the design we write. The SDK
	// infers a sensible HTML `autocomplete` token per field (name/email/tel/
	// address/…), so browsers offer autofill out of the box — autofill is ON by
	// default; `auto-complete="false"` would disable it, and `field-auto-complete`
	// (JSON) overrides per field.
	const form = el("biab-form", {
		class: "biab-card contact",
		slug: FORM_SLUG,
		"submit-label": "Send message",
		"auto-complete": "true",
	});

	target.replaceChildren(lead, form);
}
