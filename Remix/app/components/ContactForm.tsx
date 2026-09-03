import { BdForm, type BdFormsClient } from "@businessdash/sdk/react";
import type { FormSchema, FormSubmitResult } from "@businessdash/sdk";

/**
 * Schema-driven contact form (client island).
 *
 * `<BdForm>` (from `@businessdash/sdk/react`) renders every field by `type`, runs
 * the same validation BD enforces, drives multi-step / conditional / grouped
 * forms, and uses the `bd-*` light-DOM classes the template already styles.
 *
 * Reads/writes through the same-origin `/api/bd/forms` resource route (see
 * `app/routes/api.bd.forms.ts`), so the BD bearer key never reaches the
 * browser. The `client` object below structurally satisfies `BdFormsClient`.
 *
 * Replace `slug="general-inquiry"` with the slug of the form you authored in BD at
 * Dashboard → Forms.
 */
const bdFormsProxy: BdFormsClient = {
	forms: {
		async schema(slug: string): Promise<FormSchema> {
			const res = await fetch(
				`/api/bd/forms?slug=${encodeURIComponent(slug)}`,
			);
			if (!res.ok) throw new Error(`Failed to load form (${res.status}).`);
			return (await res.json()) as FormSchema;
		},
		async submit(
			slug: string,
			data: Record<string, unknown>,
			opts?: Record<string, unknown>,
		): Promise<FormSubmitResult> {
			const res = await fetch("/api/bd/forms", {
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
			<BdForm
				slug="general-inquiry"
				client={bdFormsProxy}
				submitLabel="Send"
				successFallback={() => (
					<p className="muted">Thanks — we'll be in touch.</p>
				)}
			/>
		</section>
	);
}
