/**
 * Browser-side adapter that lets the `<bd-form>` drop-in component
 * (`@businessdash/sdk/angular`) talk to BD WITHOUT ever holding the API key in the
 * browser bundle.
 *
 * `createFormController` (inside the component) only ever touches `client.forms`
 * — `schema(slug)`, `submit(slug, data, opts)`, and `uploadFile(...)`. So instead
 * of constructing a real `createBdClient({ apiKey })` here (which would leak the
 * key to the browser), we hand the component a tiny object that implements just
 * the `forms` resource by calling the two server proxies added in
 * `src/server/bd-api.ts`:
 *
 *   GET  /api/bd/forms/:slug/schema   → bd.forms.schema(slug)   (key server-side)
 *   POST /api/bd/forms/:slug/submit   → bd.forms.submit(...)    (key server-side)
 *
 * This mirrors how every other surface in this starter is wired (see
 * `bd-api.client.ts`): the SSR Express server is the only place the key lives.
 *
 * The object is typed as `BdClient` via a cast — the component never reaches
 * past `client.forms`, so the other resources are intentionally unimplemented.
 */

import type {
	BdClient,
	FormFileValue,
	FormSchema,
	FormSubmissionData,
	FormSubmitResult,
} from "@businessdash/sdk/forms";

/** Resolve a path against the current origin (SSR-safe, like bd-api.client). */
function apiUrl(path: string): string {
	if (typeof window !== "undefined" && window.location?.origin) {
		return new URL(path, window.location.origin).toString();
	}
	return path;
}

const formsResource: BdClient["forms"] = {
	async schema(slug: string): Promise<FormSchema> {
		const res = await fetch(apiUrl(`/api/bd/forms/${encodeURIComponent(slug)}/schema`), {
			headers: { Accept: "application/json" },
		});
		if (!res.ok) {
			throw new Error(`Failed to load form "${slug}" (${res.status}).`);
		}
		return (await res.json()) as FormSchema;
	},

	async submit(
		slug: string,
		data: FormSubmissionData,
		opts?: {
			submitterEmail?: string;
			submitterName?: string;
			skipValidate?: boolean;
			dryRun?: boolean;
			source?: string;
			referrer?: string;
			metadata?: Record<string, unknown>;
		},
	): Promise<FormSubmitResult> {
		try {
			const res = await fetch(apiUrl(`/api/bd/forms/${encodeURIComponent(slug)}/submit`), {
				method: "POST",
				headers: { "Content-Type": "application/json", Accept: "application/json" },
				body: JSON.stringify({ data, ...opts }),
			});
			// The proxy passes the FormSubmitResult straight through, on both 200
			// and non-2xx. Parse the body regardless so field-level issues survive.
			return (await res.json()) as FormSubmitResult;
		} catch (err) {
			return {
				ok: false,
				status: 0,
				reason: "network_error",
				message: err instanceof Error ? err.message : "The submission failed.",
			};
		}
	},

	// File uploads need a presigned-URL round-trip the proxy doesn't expose yet;
	// the demo form has no file field. Wire a `/api/bd/forms/:slug/upload-url`
	// proxy and call client.forms.uploadFile server-side if you add one.
	async uploadFile(): Promise<FormFileValue> {
		throw new Error(
			"File uploads are not enabled in this starter. Add an upload-url proxy to support them.",
		);
	},

	// 0.9.54 surface. The demo form has no credit_card or auto-schedule field;
	// proxy these like `schema`/`submit` if you add one.
	async paymentIntent(): ReturnType<BdClient["forms"]["paymentIntent"]> {
		throw new Error(
			"Card payments are not enabled in this starter. Add a payment-intent proxy to support them.",
		);
	},
	async scheduleSlots(): ReturnType<BdClient["forms"]["scheduleSlots"]> {
		return { slots: [] };
	},
};

/**
 * The browser-safe BdClient the `<bd-form>` component consumes. Only the
 * `forms` resource is implemented — that is all `createFormController` uses.
 */
export const bdFormsClient = { forms: formsResource } as unknown as BdClient;
