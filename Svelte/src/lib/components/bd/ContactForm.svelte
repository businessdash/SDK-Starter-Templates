<!--
  ContactForm — now a thin wrapper around the SDK drop-in <BdForm>.

  Before, this component hand-rolled the field loop, value state, and submit
  fetch. <BdForm> (from `@businessdash/sdk/svelte`) replaces all of that: it
  drives the headless form controller, renders every field type / multi-step /
  condition / concurrent-reveal exactly like the BD dashboard preview, and
  applies the form's own render settings (animation, progress, org icon).

  Data path (server-safe): the page's `+page.server.ts` already SSR-fetches the
  schema with the server-only BdClient (`bd.forms.schema(slug)`), so we pass
  that `schema` straight in — no client key in the browser. Submission goes
  through `submitAction`, which POSTs to the existing
  `/api/bd/forms/[slug]` endpoint (which calls `bd.forms.submit` server-side).

  Requires `@businessdash/sdk` >= the release that ships the `./svelte` subpath
  (the version that bundles `src/svelte/BdForm.svelte`). The package.json here
  already pins `^0.9.7`.
-->
<script lang="ts">
	import {
		BdForm,
		type BdFormSubmitAction,
		type FormSchema,
		type FormSubmitResult,
	} from "@businessdash/sdk/svelte";

	let { schema, slug }: { schema: FormSchema; slug: string } = $props();

	// Server-safe submit: forward the re-keyed payload to our own endpoint so the
	// bearer key stays in `$lib/server`. The endpoint returns the SDK's
	// FormSubmitResult JSON, which we hand back so <BdForm> can show inline
	// field errors on a server-side validation failure.
	const submitAction: BdFormSubmitAction = async (payload, options) => {
		const res = await fetch(`/api/bd/forms/${encodeURIComponent(slug)}`, {
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

<section class="bd-section bd-section--narrow" id="contact">
	<div class="bd-section__lead">
		<span class="bd-section__eyebrow">Contact</span>
	</div>
	<div class="bd-card contact">
		<BdForm
			{schema}
			{slug}
			{submitAction}
			autoComplete
			submitLabel="Send message"
			successMessage="Thanks — we'll be in touch within one business day."
		/>
	</div>
</section>
