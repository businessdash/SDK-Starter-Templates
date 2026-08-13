import { BiabForm } from "@businessdash/sdk/react";

import { biab } from "../lib/biab";

/**
 * Schema-driven contact form, now a one-line drop-in.
 *
 * `<BiabForm>` (from `@businessdash/sdk/react`) owns the entire lifecycle: it fetches
 * the form schema, renders every field by `type` (text, select, file upload,
 * star rating, address, multi-step groups, conditional blocks…), runs the same
 * validation the BIAB server enforces, and submits via the client — all with the
 * `biab-*` light-DOM classes this template already styles in `index.css`, so it
 * inherits the site look and you can override any hook from your own CSS.
 *
 * `client={biab}` passes the template's same-origin proxy (see `lib/biab.ts`),
 * which forwards `forms.schema` / `forms.submit` to the Bun server so the bearer
 * key never reaches the browser. The proxy's `forms` shape structurally matches
 * the component's `BiabFormsClient` contract.
 *
 * Replace `slug="general-inquiry"` with the slug of the form you authored in BIAB at
 * Dashboard → Forms.
 */
export function ContactForm() {
	return (
		<section className="biab-section biab-section--narrow" id="contact">
			<div className="biab-card contact">
				<BiabForm
					slug="general-inquiry"
					client={biab}
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
