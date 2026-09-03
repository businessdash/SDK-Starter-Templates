import { component$ } from "@builder.io/qwik";
import { server$ } from "@builder.io/qwik-city";
import { BdForm } from "@businessdash/sdk/qwik";
import type {
	FormSchema,
	FormSubmitOptions,
	FormSubmitResult,
} from "@businessdash/sdk/forms";

import { getBd } from "../../lib/bd";

// Re-export the schema type so `routes/index.tsx` keeps its import path. The
// loader hands `<BdForm>` the FULL published schema (nested field tree +
// settings + org icon) — the drop-in renders every field type, multi-step
// progress, conditions, and concurrent reveal, identical to the dashboard
// preview, with no hand-rolled per-field markup here anymore.
export type { FormSchema };

// The form slug to load + submit. Swap for any of your org's form slugs.
const SLUG = "general-inquiry";

/**
 * Server RPC — the actual `forms.submit` round-trip runs ONLY here, so the
 * BD bearer key never enters the client bundle. `<BdForm>` validates +
 * re-keys the payload (id → published output key) in the headless core, then
 * hands us the wire-ready payload to forward through the SDK. The SDK re-runs
 * server-side validation before persisting, so a bad payload fails here without
 * writing anything to BD.
 */
const submitContactForm = server$(async function (
	payload: Record<string, unknown>,
	options: FormSubmitOptions,
): Promise<FormSubmitResult> {
	const bd = getBd();
	if (!bd) {
		return {
			ok: false,
			status: 0,
			reason: "network_error",
			message: "BD is not configured (missing env).",
		};
	}
	return await bd.forms.submit(SLUG, payload, {
		// Recipient hints help BD attribute the lead; the field output keys
		// "email"/"name" come from the published schema.
		submitterEmail:
			typeof payload.email === "string" ? payload.email : undefined,
		submitterName: typeof payload.name === "string" ? payload.name : undefined,
		source: "qwik-starter",
		...options,
	});
});

/**
 * The contact section, now a thin shell around the SDK's `<BdForm>` drop-in.
 * `schema` comes pre-fetched from the page's `routeLoader$` (server-side, no
 * client flicker, key stays server-side); `submit$` delegates the round-trip to
 * the `server$` RPC above. Everything else — values, validation, conditions,
 * multi-step nav, progress, file uploads, the submit lifecycle — lives in the
 * headless core. Style it via the `bd-*` classes in your CSS.
 */
export const ContactForm = component$<{ schema: FormSchema; slug: string }>(
	({ schema }) => {
		return (
			<section class="bd-section bd-section--narrow" id="contact">
				<div class="bd-section__lead">
					<span class="bd-section__eyebrow">Contact</span>
					<h2 class="bd-section__title">{schema.title ?? "Get in touch"}</h2>
					{schema.description ? (
						<p class="bd-section__sub">{schema.description}</p>
					) : null}
				</div>

				<BdForm
					// Autofill is ON by default in 0.9.12 — `<BdForm>` infers a
					// sensible HTML `autocomplete` token per field (name/email/tel/
					// address/…), so browsers offer autofill with no config. Set
					// explicitly here to document intent; pass `autoComplete={false}` to
					// turn it off, or `fieldAutoComplete={{ phone: "tel" }}` to override
					// individual fields.
					autoComplete
					class="bd-card contact"
					schema={schema}
					submit$={submitContactForm}
					submitLabel="Send message"
				>
					{/* Optional override slots — style or replace as you like. */}
					<div q:slot="success" class="bd-form__success">
						<span class="bd-badge">Received</span>
						<h3>Got it.</h3>
						<p>We'll be in touch within one business day.</p>
					</div>
					<div q:slot="loading" class="bd-form__loading">
						Loading form…
					</div>
				</BdForm>
			</section>
		);
	},
);
