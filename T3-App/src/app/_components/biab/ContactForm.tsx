"use client";

import { useMemo } from "react";

import { BiabForm, type BiabFormsClient } from "@businessdash/sdk/react";
import type { FormSchema, FormSubmitResult } from "@businessdash/sdk";

import { api } from "@/trpc/react";

/**
 * Schema-driven contact form as a one-line drop-in.
 *
 * The schema is fetched on the server (RSC) and handed in as `schema`, so
 * `<BiabForm>` adopts it synchronously — no client round-trip to render. Submits
 * go through the existing tRPC `submitForm` mutation via a thin `client` adapter,
 * so the BIAB bearer key stays server-side and we reuse the app's data layer.
 *
 * `<BiabForm>` (from `@businessdash/sdk/react`) renders every field by `type`, runs
 * the same validation BIAB enforces, drives multi-step / conditional / grouped
 * forms, and uses the `biab-*` light-DOM classes this template already styles —
 * so it inherits the site look and any hook is overridable from your CSS.
 */
export function ContactForm({
	schema,
	slug,
}: {
	schema: FormSchema;
	slug: string;
}) {
	const submit = api.biab.submitForm.useMutation();

	// Adapter satisfying the component's `BiabFormsClient` contract. Only `submit`
	// is exercised here (the schema is pre-fetched); `schema` is provided for
	// completeness so the same `client` works without a pre-fetched schema too.
	const client = useMemo<BiabFormsClient>(
		() => ({
			forms: {
				async schema() {
					return schema;
				},
				async submit(
					formSlug: string,
					data: Record<string, unknown>,
					opts?: Record<string, unknown>,
				): Promise<FormSubmitResult> {
					return (await submit.mutateAsync({
						slug: formSlug,
						data,
						submitterEmail: (opts?.submitterEmail as string) ?? undefined,
						submitterName: (opts?.submitterName as string) ?? undefined,
					})) as FormSubmitResult;
				},
			},
		}),
		[schema, submit],
	);

	return (
		<section className="biab-section biab-section--narrow" id="contact">
			<div className="biab-card contact">
				<BiabForm
					slug={slug}
					schema={schema}
					client={client}
					submitLabel="Send message"
					successFallback={() => (
						<div>
							<span
								className="biab-badge"
								style={{ alignSelf: "flex-start" }}
							>
								Received
							</span>
							<h2 className="biab-section__title">Got it.</h2>
							<p>We'll be in touch within one business day.</p>
						</div>
					)}
				/>
			</div>
		</section>
	);
}
