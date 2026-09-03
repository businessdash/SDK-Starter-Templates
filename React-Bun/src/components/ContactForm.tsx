import { BdForm } from "@businessdash/sdk/react";

import { bd } from "../lib/bd";

/**
 * Schema-driven contact form, now a one-line drop-in.
 *
 * `<BdForm>` (from `@businessdash/sdk/react`) owns the entire lifecycle: it fetches
 * the form schema, renders every field by `type` (text, select, file upload,
 * star rating, address, multi-step groups, conditional blocks…), runs the same
 * validation the BD server enforces, and submits via the client — all with the
 * `bd-*` light-DOM classes this template already styles in `index.css`, so it
 * inherits the site look and you can override any hook from your own CSS.
 *
 * `client={bd}` passes the template's same-origin proxy (see `lib/bd.ts`),
 * which forwards `forms.schema` / `forms.submit` to the Bun server so the bearer
 * key never reaches the browser. The proxy's `forms` shape structurally matches
 * the component's `BdFormsClient` contract.
 *
 * Replace `slug="general-inquiry"` with the slug of the form you authored in BD at
 * Dashboard → Forms.
 */
export function ContactForm() {
	return (
		<section className="bd-section bd-section--narrow" id="contact">
			<div className="bd-card contact">
				<BdForm
					slug="general-inquiry"
					client={bd}
					submitLabel="Send message"
					successFallback={() => (
						<div>
							<span
								className="bd-badge"
								style={{ alignSelf: "flex-start" }}
							>
								Received
							</span>
							<h2 className="bd-section__title">Got it.</h2>
							<p>We'll be in touch within one business day.</p>
						</div>
					)}
				/>
			</div>
		</section>
	);
}
