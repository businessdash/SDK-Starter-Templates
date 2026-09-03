import { BdForm, type BdFormsClient } from "@businessdash/sdk/react";
import type { FormSchema, FormSubmitResult } from "@businessdash/sdk";

/**
 * Schema-driven contact form as a React island.
 *
 * Drop it into any `.astro` page with a client directive:
 *
 *     ---
 *     import ContactForm from "../components/ContactForm.tsx";
 *     ---
 *     <ContactForm client:load />
 *
 * `<BdForm>` (from `@businessdash/sdk/react`) renders every field by `type`, runs
 * the same validation BD enforces, drives multi-step / conditional / grouped
 * forms, and uses the `bd-*` light-DOM classes this template already styles.
 *
 * It reads/writes through the same-origin `/api/bd/forms/[slug]` endpoint, so
 * the BD bearer key never reaches the browser. The `client` below structurally
 * satisfies `BdFormsClient`.
 *
 * ── Activation ──────────────────────────────────────────────────────────────
 * This island needs React, which the base Astro starter doesn't bundle. To turn
 * it on, add the integration (these touch package.json + astro.config, which the
 * SDK keeps as a consumer choice):
 *
 *     npx astro add react
 *     # installs @astrojs/react + react + react-dom and registers the integration
 *
 * Until then the page falls back to the vanilla `ContactForm.astro` island.
 */
const FORM_SLUG = "general-inquiry";

const bdFormsProxy: BdFormsClient = {
	forms: {
		async schema(slug: string): Promise<FormSchema> {
			const res = await fetch(`/api/bd/forms/${encodeURIComponent(slug)}`);
			if (!res.ok) throw new Error(`Failed to load form (${res.status}).`);
			return (await res.json()) as FormSchema;
		},
		async submit(
			slug: string,
			data: Record<string, unknown>,
			opts?: Record<string, unknown>,
		): Promise<FormSubmitResult> {
			const res = await fetch(`/api/bd/forms/${encodeURIComponent(slug)}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ data, ...opts }),
			});
			return (await res.json()) as FormSubmitResult;
		},
	},
};

export default function ContactForm() {
	return (
		<section className="bd-section bd-section--narrow" id="contact">
			<div className="bd-card contact">
				<BdForm
					slug={FORM_SLUG}
					client={bdFormsProxy}
					submitLabel="Send message"
					successFallback={() => (
						<div>
							<span
								className="bd-badge"
								style={{ alignSelf: "flex-start" }}
							>
								Received
							</span>
							<h2 className="bd-section__title">Got it.</h2>
							<p>We'll be in touch within one business day.</p>
						</div>
					)}
				/>
			</div>
		</section>
	);
}
