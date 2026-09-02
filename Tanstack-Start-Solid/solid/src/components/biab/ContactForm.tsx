import { Show, createSignal } from "solid-js";

import {
	BiabForm,
	type BiabClient,
	type FormSchema as SdkFormSchema,
	type FormSubmitResult,
} from "@businessdash/sdk/solid";

import { type FormSchema, submitContactForm } from "../../lib/biab-server-fns";

/**
 * The contact form, rendered by the SDK's `<BiabForm>` drop-in.
 *
 * Why a "submit shim" instead of a real browser client:
 * this starter keeps the BIAB API key strictly server-side (it is never
 * `VITE_`-prefixed, so it never reaches the browser bundle — see
 * `src/lib/biab.ts`). `<BiabForm>` needs a `client` for the submit round-trip,
 * so we hand it a tiny object that satisfies only the `forms.submit` surface the
 * controller calls, delegating to the existing `submitContactForm` server
 * function (which holds the real client). The schema is pre-fetched server-side
 * in `getHomeData` and passed in via `schema`, so no `forms.schema` call (and no
 * key) is ever needed in the browser.
 *
 * Swap target: this replaced the hand-rolled `<For>`-over-fields form. The whole
 * field tree, per-field rendering, validation (mirrored from the server),
 * multi-step nav, progress, concurrent reveal, and the submit lifecycle now live
 * inside `<BiabForm>`. To point it at a different published form, change the
 * `slug` here and in `FORM_SLUG` in `biab-server-fns.ts`.
 */
export function ContactForm(props: { schema: FormSchema; slug: string }) {
	const [confirmation, setConfirmation] = createSignal<string | null>(null);

	// Minimal client shim — only `forms.submit` is exercised because we pass a
	// pre-fetched `schema`. The cast is deliberate: we implement exactly the slice
	// of `BiabClient` the form controller touches in schema-prefetched mode.
	const submitClient = {
		forms: {
			async submit(
				slug: string,
				data: Record<string, unknown>,
			): Promise<FormSubmitResult> {
				try {
					const res = (await submitContactForm({
						data: { slug, values: data },
					})) as FormSubmitResult;
					return res;
				} catch (err) {
					return {
						ok: false,
						status: 0,
						reason: "network_error",
						message:
							err instanceof Error ? err.message : "Couldn't submit the form.",
					};
				}
			},
		},
	} as unknown as BiabClient;

	return (
		<section class="biab-section biab-section--narrow" id="contact">
			<Show
				when={!confirmation()}
				fallback={
					<div class="biab-card contact">
						<span class="biab-badge" style="align-self: flex-start;">
							Received
						</span>
						<h2 class="biab-section__title">Got it.</h2>
						<p>{confirmation()}</p>
					</div>
				}
			>
				<div class="biab-section__lead">
					<span class="biab-section__eyebrow">Contact</span>
					<h2 class="biab-section__title">
						{props.schema.title ?? "Get in touch"}
					</h2>
					<Show when={props.schema.description}>
						<p class="biab-section__sub">{props.schema.description}</p>
					</Show>
				</div>
				<div class="biab-card contact">
					<BiabForm
						slug={props.slug}
						// Pre-fetched server-side in getHomeData — the controller adopts it
						// synchronously, so no schema network call runs in the browser.
						schema={props.schema as unknown as SdkFormSchema}
						client={submitClient}
						submitLabel="Send message"
						onSuccess={() =>
							setConfirmation(
								"Thanks — we'll be in touch within one business day.",
							)
						}
					/>
				</div>
			</Show>
		</section>
	);
}
