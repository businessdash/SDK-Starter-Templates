<!--
  ContactForm — now a thin wrapper around the SDK drop-in <BiabForm>.

  Before, this component hand-rolled the field loop, value state, and submit
  fetch. <BiabForm> (from `@businessdash/sdk/svelte`) replaces all of that: it
  drives the headless form controller, renders every field type / multi-step /
  condition / concurrent-reveal exactly like the BIAB dashboard preview, and
  applies the form's own render settings (animation, progress, org icon).

  Data path (server-safe): the page's `+page.server.ts` already SSR-fetches the
  schema with the server-only BiabClient (`biab.forms.schema(slug)`), so we pass
  that `schema` straight in — no client key in the browser. Submission goes
  through `submitAction`, which POSTs to the existing
  `/api/biab/forms/[slug]` endpoint (which calls `biab.forms.submit` server-side).

  Requires `@businessdash/sdk` >= the release that ships the `./svelte` subpath
  (the version that bundles `src/svelte/BiabForm.svelte`). The package.json here
  already pins `^0.9.7`.
-->
<script lang="ts">
	import {
		BiabForm,
		type BiabFormSubmitAction,
		type FormSchema,
		type FormSubmitResult,
	} from "@businessdash/sdk/svelte";

	let { schema, slug }: { schema: FormSchema; slug: string } = $props();

	// Server-safe submit: forward the re-keyed payload to our own endpoint so the
	// bearer key stays in `$lib/server`. The endpoint returns the SDK's
	// FormSubmitResult JSON, which we hand back so <BiabForm> can show inline
	// field errors on a server-side validation failure.
	const submitAction: BiabFormSubmitAction = async (payload, options) => {
		const res = await fetch(`/api/biab/forms/${encodeURIComponent(slug)}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				data: payload,
				submitterEmail:
					(payload.email as string | undefined) ??
					(payload.contactEmail as string | undefined),
				submitterName:
					(payload.name as string | undefined) ??
					(payload.fullName as string | undefined),
				...options,
			}),
		});
		if (!res.ok) {
			// The endpoint throws a 400 with the message on validation failure.
			throw new Error(await res.text());
		}
		return (await res.json()) as FormSubmitResult;
	};
</script>

<section class="biab-section biab-section--narrow" id="contact">
	<div class="biab-section__lead">
		<span class="biab-section__eyebrow">Contact</span>
	</div>
	<div class="biab-card contact">
		<BiabForm
			{schema}
			{slug}
			{submitAction}
			autoComplete
			submitLabel="Send message"
			successMessage="Thanks — we'll be in touch within one business day."
		/>
	</div>
</section>
