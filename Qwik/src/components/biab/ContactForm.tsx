import { component$ } from "@builder.io/qwik";
import { server$ } from "@builder.io/qwik-city";
import { BiabForm } from "@businessdash/sdk/qwik";
import type {
	FormSchema,
	FormSubmitOptions,
	FormSubmitResult,
} from "@businessdash/sdk/forms";

import { getBiab } from "../../lib/biab";

// Re-export the schema type so `routes/index.tsx` keeps its import path. The
// loader hands `<BiabForm>` the FULL published schema (nested field tree +
// settings + org icon) — the drop-in renders every field type, multi-step
// progress, conditions, and concurrent reveal, identical to the dashboard
// preview, with no hand-rolled per-field markup here anymore.
export type { FormSchema };

// The form slug to load + submit. Swap for any of your org's form slugs.
const SLUG = "general-inquiry";

/**
 * Server RPC — the actual `forms.submit` round-trip runs ONLY here, so the
 * BIAB bearer key never enters the client bundle. `<BiabForm>` validates +
 * re-keys the payload (id → published output key) in the headless core, then
 * hands us the wire-ready payload to forward through the SDK. The SDK re-runs
 * server-side validation before persisting, so a bad payload fails here without
 * writing anything to BIAB.
 */
const submitContactForm = server$(async function (
	payload: Record<string, unknown>,
	options: FormSubmitOptions,
): Promise<FormSubmitResult> {
	const biab = getBiab();
	if (!biab) {
		return {
			ok: false,
			status: 0,
			reason: "network_error",
			message: "BIAB is not configured (missing env).",
		};
	}
	return await biab.forms.submit(SLUG, payload, {
		// Recipient hints help BIAB attribute the lead; the field output keys
		// "email"/"name" come from the published schema.
		submitterEmail:
			typeof payload.email === "string" ? payload.email : undefined,
		submitterName: typeof payload.name === "string" ? payload.name : undefined,
		source: "qwik-starter",
		...options,
	});
});

/**
 * The contact section, now a thin shell around the SDK's `<BiabForm>` drop-in.
 * `schema` comes pre-fetched from the page's `routeLoader$` (server-side, no
 * client flicker, key stays server-side); `submit$` delegates the round-trip to
 * the `server$` RPC above. Everything else — values, validation, conditions,
 * multi-step nav, progress, file uploads, the submit lifecycle — lives in the
 * headless core. Style it via the `biab-*` classes in your CSS.
 */
export const ContactForm = component$<{ schema: FormSchema; slug: string }>(
	({ schema }) => {
		return (
			<section class="biab-section biab-section--narrow" id="contact">
				<div class="biab-section__lead">
					<span class="biab-section__eyebrow">Contact</span>
					<h2 class="biab-section__title">{schema.title ?? "Get in touch"}</h2>
					{schema.description ? (
						<p class="biab-section__sub">{schema.description}</p>
					) : null}
				</div>

				<BiabForm
					// Autofill is ON by default in 0.9.12 — `<BiabForm>` infers a
					// sensible HTML `autocomplete` token per field (name/email/tel/
					// address/…), so browsers offer autofill with no config. Set
					// explicitly here to document intent; pass `autoComplete={false}` to
					// turn it off, or `fieldAutoComplete={{ phone: "tel" }}` to override
					// individual fields.
					autoComplete
					class="biab-card contact"
					schema={schema}
					submit$={submitContactForm}
					submitLabel="Send message"
				>
					{/* Optional override slots — style or replace as you like. */}
					<div q:slot="success" class="biab-form__success">
						<span class="biab-badge">Received</span>
						<h3>Got it.</h3>
						<p>We'll be in touch within one business day.</p>
					</div>
					<div q:slot="loading" class="biab-form__loading">
						Loading form…
					</div>
				</BiabForm>
			</section>
		);
	},
);
