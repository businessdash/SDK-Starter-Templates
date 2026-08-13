import { BiabForm, type BiabFormsClient } from "@businessdash/sdk/react";
import type { FormSchema, FormSubmitResult } from "@businessdash/sdk";

/**
 * Schema-driven contact form (client island).
 *
 * `<BiabForm>` (from `@businessdash/sdk/react`) renders every field by `type`, runs
 * the same validation BIAB enforces, drives multi-step / conditional / grouped
 * forms, and uses the `biab-*` light-DOM classes the template already styles.
 *
 * Reads/writes through the same-origin `/api/biab/forms` resource route (see
 * `app/routes/api.biab.forms.ts`), so the BIAB bearer key never reaches the
 * browser. The `client` object below structurally satisfies `BiabFormsClient`.
 *
 * Replace `slug="general-inquiry"` with the slug of the form you authored in BIAB at
 * Dashboard → Forms.
 */
const biabFormsProxy: BiabFormsClient = {
	forms: {
		async schema(slug: string): Promise<FormSchema> {
			const res = await fetch(
				`/api/biab/forms?slug=${encodeURIComponent(slug)}`,
			);
			if (!res.ok) throw new Error(`Failed to load form (${res.status}).`);
			return (await res.json()) as FormSchema;
		},
		async submit(
			slug: string,
			data: Record<string, unknown>,
			opts?: Record<string, unknown>,
		): Promise<FormSubmitResult> {
			const res = await fetch("/api/biab/forms", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ slug, data, ...opts }),
			});
			return (await res.json()) as FormSubmitResult;
		},
	},
};

export function ContactForm() {
	return (
		<section className="section" id="contact">
			<BiabForm
				slug="general-inquiry"
				client={biabFormsProxy}
				submitLabel="Send"
				successFallback={() => (
					<p className="muted">Thanks — we'll be in touch.</p>
				)}
			/>
		</section>
	);
}
