"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import { BiabForm, type BiabFormsClient } from "@businessdash/sdk/react";
import type { FormSchema, FormSubmitResult } from "@businessdash/sdk";

import { api } from "@/trpc/react";

/**
 * "Add a todo" — the WRITE path of the custom-collections demo.
 *
 * Custom-collection rows are created by submitting the model's auto-generated
 * create form (`todo-form`), not by a direct row-write API — the form carries
 * the `create_records` action that inserts the row server-side. `<BiabForm>`
 * renders the generated schema exactly like the contact form, and the submit
 * rides the existing tRPC `submitForm` mutation so the bearer key stays
 * server-side. On success we `router.refresh()` so the RSC list re-reads.
 */
export function TodoCreateForm({
	schema,
	slug,
}: {
	schema: FormSchema;
	slug: string;
}) {
	const router = useRouter();
	const submit = api.biab.submitForm.useMutation();

	const client = useMemo<BiabFormsClient>(
		() => ({
			forms: {
				async schema() {
					return schema;
				},
				async submit(
					formSlug: string,
					data: Record<string, unknown>,
				): Promise<FormSubmitResult> {
					return (await submit.mutateAsync({
						slug: formSlug,
						data,
					})) as FormSubmitResult;
				},
			},
		}),
		[schema, submit],
	);

	return (
		<div className="biab-card">
			<h2 className="biab-section__title">Add a todo</h2>
			<BiabForm
				slug={slug}
				schema={schema}
				client={client}
				submitLabel="Add todo"
				onSuccess={() => router.refresh()}
				successFallback={() => (
					<p>
						Added. <span className="biab-badge">Saved to your custom DB</span>
					</p>
				)}
			/>
		</div>
	);
}
