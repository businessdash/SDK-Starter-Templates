"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import { BdForm, type BdFormsClient } from "@businessdash/sdk/react";
import type { FormSchema, FormSubmitResult } from "@businessdash/sdk";

import { api } from "@/trpc/react";

/**
 * "Add a todo" — the WRITE path of the custom-collections demo.
 *
 * Custom-collection rows are created by submitting the model's auto-generated
 * create form (`todo-form`), not by a direct row-write API — the form carries
 * the `create_records` action that inserts the row server-side. `<BdForm>`
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
	const submit = api.bd.submitForm.useMutation();

	const client = useMemo<BdFormsClient>(
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
		<div className="bd-card">
			<h2 className="bd-section__title">Add a todo</h2>
			<BdForm
				slug={slug}
				schema={schema}
				client={client}
				submitLabel="Add todo"
				onSuccess={() => router.refresh()}
				successFallback={() => (
					<p>
						Added. <span className="bd-badge">Saved to your custom DB</span>
					</p>
				)}
			/>
		</div>
	);
}
