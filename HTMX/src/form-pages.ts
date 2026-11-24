/**
 * Where the forms of `./form` appear: a page per form (`/forms/<slug>`, the
 * bundled sample at `/forms/demo`) and the home page's contact section.
 */

import { getBd } from "./bd";
import { DEMO_FORM_SLUG, loadFormSchema, renderForm } from "./form";
import { html, render, type Raw } from "./html";
import { page } from "./layout";

/** The contact section's form: `BD_CONTACT_FORM`, or the sample until BD is connected. */
export function contactFormSlug(): string {
	if (!getBd()) return DEMO_FORM_SLUG;
	return process.env["BD_CONTACT_FORM"] || "general-inquiry";
}

export async function contactSection(): Promise<string> {
	const form = await renderForm(contactFormSlug(), { submitLabel: "Send message" });
	return render(html`<section class="section contact" id="contact">
		<h2 class="section-title">Get in touch</h2>
		${form}
	</section>`);
}

/** A form on a page of its own (also what a form post returns without JavaScript). */
export async function formPage(origin: string, slug: string, form: Raw): Promise<string> {
	const schema = await loadFormSchema(slug).catch(() => null);
	const title = (schema as { name?: string } | null)?.name || "Form";
	return page({
		origin,
		title,
		body: html`<header class="page__head"><h1 class="page__title">${title}</h1></header>
			<div class="form-page">${form}</div>`,
	});
}
