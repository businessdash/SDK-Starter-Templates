<script setup lang="ts">
/**
 * Contact section — now a thin wrapper around the SDK's <BdForm> drop-in.
 *
 * Before, this component hand-rolled the field loop, the submit fetch, and the
 * confirmation state. Now `@businessdash/sdk/vue`'s <BdForm> owns ALL of that:
 * it renders the full field tree (every field type, condition_block /
 * or_condition, multi-step + progress, concurrent reveal, org icon, animation)
 * straight from the published schema, validates against the same rules the BD
 * server enforces, and manages the submit lifecycle. We just hand it the
 * SSR-prefetched `schema` and a custom `:on-submit`.
 *
 * Why `:on-submit` (and not `:client`)? This starter keeps the BD bearer key
 * SERVER-ONLY (`server/utils/bd.ts`). So instead of giving the browser an SDK
 * client, we let <BdForm> validate locally and hand us the re-keyed wire
 * payload, which we POST through the existing proxy route
 * (`server/api/bd/forms/[slug].post.ts`). The key never reaches the client.
 *
 * The `bd-*` classes <BdForm> emits are already themed by
 * `app/assets/css/bd-tokens.css` (`.bd-input`, `.bd-label`, `.bd-btn`,
 * `.bd-textarea`), so the drop-in inherits the site's look with no extra CSS.
 */
import { BdForm } from "@businessdash/sdk/vue";
import type {
	FormData,
	FormSchema,
	FormSubmitOptions,
	FormSubmitResult,
} from "@businessdash/sdk/vue";

// The SSR endpoint (`server/api/bd/home.get.ts`) prefetches this via
// `bd.forms.schema(FORM_SLUG)`; the SDK's `FormSchema` is the full nested
// tree the renderer needs (a superset of the starter's local minimal type).
const props = defineProps<{ schema: FormSchema; slug: string }>();

/**
 * Custom submit: POST the re-keyed payload to our own Nitro proxy. We surface
 * the proxy's response as a `FormSubmitResult` so <BdForm> can render the
 * exact success / error state inline.
 */
async function handleSubmit(
	payload: FormData,
	opts: FormSubmitOptions,
): Promise<FormSubmitResult> {
	try {
		await $fetch(`/api/bd/forms/${encodeURIComponent(props.slug)}`, {
			method: "POST",
			body: {
				data: payload,
				submitterEmail: opts.submitterEmail,
				submitterName: opts.submitterName,
			},
		});
		return { ok: true, status: 200 };
	} catch (err) {
		const message =
			err && typeof err === "object" && "statusMessage" in err
				? String((err as { statusMessage?: unknown }).statusMessage)
				: err instanceof Error
					? err.message
					: "Couldn't submit. Please try again.";
		return { ok: false, status: 0, reason: "server_error", message };
	}
}
</script>

<template>
	<section id="contact" class="bd-section bd-section--narrow">
		<div class="bd-section__lead">
			<span class="bd-section__eyebrow">Contact</span>
			<h2 class="bd-section__title">
				{{ schema.title ?? "Get in touch" }}
			</h2>
			<p v-if="schema.description" class="bd-section__sub">
				{{ schema.description }}
			</p>
		</div>

		<div class="bd-card contact">
			<!--
				The whole form is now this one tag. Swap `:schema`/`:slug` for any
				published form slug — e.g. drop <BdForm slug="job-application" />
				with a `:client` instead of `:schema` if you expose a browser-safe
				SDK client. Here we stay server-only and submit via `:on-submit`.
			-->
			<!--
				`auto-complete` is ON by default in 0.9.12 — <BdForm> infers a
				sensible HTML autocomplete token per field (name/email/tel/address/…)
				so browsers offer autofill with no config. Passed explicitly here to
				make the intent visible; set `:auto-complete="false"` to disable, or
				`:field-auto-complete="{ phone: 'tel', note: 'off' }"` to override
				individual fields.
			-->
			<BdForm
				:schema="schema"
				:slug="slug"
				:on-submit="handleSubmit"
				:auto-complete="true"
				submit-label="Send message"
			>
				<template #success>
					<span class="bd-badge" style="align-self: flex-start"
						>Received</span
					>
					<h3 class="bd-section__title">Got it.</h3>
					<p>We'll be in touch within one business day.</p>
				</template>
			</BdForm>
		</div>
	</section>
</template>
