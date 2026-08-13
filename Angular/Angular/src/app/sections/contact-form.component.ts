import { ChangeDetectionStrategy, Component } from "@angular/core";
import { BiabFormComponent } from "@businessdash/sdk/angular";
import type { FormSubmitResult } from "@businessdash/sdk/forms";

import { biabFormsClient } from "../lib/biab-forms.client";

/**
 * Contact section — now powered by the `<biab-form>` drop-in component from
 * `@businessdash/sdk/angular` instead of a hand-rolled reactive form.
 *
 * `<biab-form>` loads the dashboard-built form by slug, renders its full field
 * tree (including any layout / multi-step / conditional fields the operator
 * adds later) with the `biab-*` CSS classes, validates with the exact same
 * rules the server enforces, and submits — all from the headless core. Adding a
 * field in the dashboard now shows up here automatically; no code change.
 *
 * SECURITY: the API key never reaches the browser. `biabFormsClient` is a thin
 * adapter whose `forms` resource hits the local `/api/biab/forms/:slug/*`
 * proxies (see `src/server/biab-api.ts`), where the key lives. For a public
 * org key you could instead `createBiabClient({ apiKey })` in the browser and
 * pass that, or provide one app-wide via `provideBiabClient(...)`.
 *
 * The 'contact' slug matches the form the marketing bundle seeds for a new
 * tenant. Swap it for any slug from your dashboard (Forms → the form's slug).
 */
@Component({
	selector: "biab-contact-form",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [BiabFormComponent],
	template: `
		<section class="section" id="contact">
			<h2 class="section__title">Get in touch</h2>
			<biab-form
				slug="general-inquiry"
				[client]="formsClient"
				submitLabel="Send"
				(success)="onSuccess($event)"
			/>
		</section>
	`,
})
export class ContactFormComponent {
	/** Browser-safe client: the `forms` resource proxies through the SSR server
	 *  so the API key stays out of the bundle. */
	readonly formsClient = biabFormsClient;

	onSuccess(_result: Extract<FormSubmitResult, { ok: true }>): void {
		// Hook for analytics / a toast. The component renders its own success
		// state, so nothing is required here.
	}
}
