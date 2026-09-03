import { component$ } from "@builder.io/qwik";
import {
	type DocumentHead,
	Form,
	routeAction$,
	routeLoader$,
	zod$,
	z,
} from "@builder.io/qwik-city";

import type { CustomerWorkBundle } from "@businessdash/sdk/contracts";

import { Footer } from "../../components/bd/Footer";
import { SiteHeader } from "../../components/bd/SiteHeader";
import {
	getCustomerSession,
	getCustomerWork,
	isCustomerPortalConfigured,
	submitCustomerReview,
} from "../../lib/bd-portal";

/**
 * Customer portal "my account" page.
 *
 *  - `routeLoader$` reads the `bd_session` cookie via `getCustomerSession`
 *    (which calls `getTenantSession`), then loads the work bundle (`getWork`).
 *  - When signed out, we render sign-in / sign-up links to the auth handler.
 *  - `routeAction$` submits a customer review through the portal.
 */
export const useAccount = routeLoader$(async ({ cookie }) => {
	const session = await getCustomerSession(cookie);
	if (!session) {
		return { configured: isCustomerPortalConfigured(), session: null, work: null };
	}
	const work = await getCustomerWork(cookie);
	return {
		configured: true,
		session: {
			email: session.user.email,
			firstName: session.user.firstName,
			lastName: session.user.lastName,
		},
		work,
	};
});

export const useSubmitReview = routeAction$(
	async (data, { cookie }) => {
		try {
			const res = await submitCustomerReview(cookie, {
				rating: data.rating,
				title: data.title || undefined,
				body: data.body,
				jobId: data.jobId || undefined,
			});
			return {
				ok: true as const,
				message:
					"Thanks! Your review was submitted and will appear once it's approved.",
				status: res.status,
			};
		} catch (err) {
			return {
				ok: false as const,
				message:
					err instanceof Error
						? err.message
						: "We couldn't submit your review. You may need to be signed in.",
			};
		}
	},
	zod$({
		rating: z.coerce.number().int().min(1).max(5),
		title: z.string().trim().max(200).optional(),
		body: z.string().trim().min(1, "Please write a few words.").max(5000),
		jobId: z
			.string()
			.uuid()
			.optional()
			.or(z.literal("").transform(() => undefined)),
	}),
);

function WorkSummary({ work }: { work: CustomerWorkBundle }) {
	const s = work.summary;
	return (
		<div class="bd-card" style="padding: 1.5rem; display: flex; gap: 1.5rem; flex-wrap: wrap;">
			<div>
				<div style="font-size: 1.5rem; font-weight: 700; color: var(--title);">
					{s.openJobCount}
				</div>
				<div style="color: var(--text-muted); font-size: 0.85rem;">
					Open jobs
				</div>
			</div>
			<div>
				<div style="font-size: 1.5rem; font-weight: 700; color: var(--title);">
					{s.pendingQuoteCount}
				</div>
				<div style="color: var(--text-muted); font-size: 0.85rem;">
					Pending quotes
				</div>
			</div>
			<div>
				<div style="font-size: 1.5rem; font-weight: 700; color: var(--title);">
					{s.unpaidInvoiceCount}
				</div>
				<div style="color: var(--text-muted); font-size: 0.85rem;">
					Unpaid invoices
				</div>
			</div>
		</div>
	);
}

export default component$(() => {
	const data = useAccount();
	const review = useSubmitReview();
	const signedIn = !!data.value.session;
	const work = data.value.work;

	return (
		<>
			<SiteHeader signedIn={signedIn} />
			<main>
				<section class="bd-section bd-section--narrow">
					<div class="bd-section__lead">
						<span class="bd-section__eyebrow">Portal</span>
						<h2 class="bd-section__title">My account</h2>
					</div>

					{!data.value.configured ? (
						<div class="bd-empty">
							Customer accounts aren't connected yet. Set
							<code> BD_AUTH_CALLBACK_URL</code> (see .env.example).
						</div>
					) : !signedIn ? (
						<div class="bd-card" style="padding: 2rem; display: flex; flex-direction: column; gap: 1rem; align-items: flex-start;">
							<p>Sign in to view your jobs, quotes, and invoices.</p>
							<div style="display: flex; gap: 0.75rem;">
								<a class="bd-btn" href="/api/bd-auth/sign-in">
									Sign in
								</a>
								<a class="bd-btn bd-btn--ghost" href="/api/bd-auth/sign-up">
									Create account
								</a>
							</div>
						</div>
					) : (
						<div style="display: flex; flex-direction: column; gap: 2rem;">
							<div class="bd-card" style="padding: 1.5rem;">
								<div style="font-weight: 600; color: var(--title);">
									{[data.value.session?.firstName, data.value.session?.lastName]
										.filter(Boolean)
										.join(" ") || "Signed in"}
								</div>
								<div style="color: var(--text-muted);">
									{data.value.session?.email}
								</div>
							</div>

							{work?.unlinked ? (
								<div class="bd-empty">
									Your account isn't linked to a customer record yet. Once we
									connect it, your jobs and invoices will show here.
								</div>
							) : work ? (
								<WorkSummary work={work} />
							) : null}

							{/* Customer review submission */}
							<div class="bd-card" style="padding: 2rem;">
								<h3 style="margin-bottom: 1rem;">Leave a review</h3>
								{review.value?.ok ? (
									<p style="color: var(--success);">
										{review.value.message}
									</p>
								) : (
									<Form
										action={review}
										style="display: flex; flex-direction: column; gap: 1rem;"
									>
										<div>
											<label class="bd-label" for="rating">
												Rating
											</label>
											<select class="bd-select" id="rating" name="rating">
												<option value="5">★★★★★ — Excellent</option>
												<option value="4">★★★★ — Good</option>
												<option value="3">★★★ — Okay</option>
												<option value="2">★★ — Poor</option>
												<option value="1">★ — Bad</option>
											</select>
										</div>
										<div>
											<label class="bd-label" for="title">
												Title (optional)
											</label>
											<input class="bd-input" id="title" name="title" />
										</div>
										<div>
											<label class="bd-label" for="body">
												Your review
											</label>
											<textarea
												class="bd-textarea"
												id="body"
												name="body"
												required
											/>
										</div>
										<button
											class="bd-btn"
											style="align-self: flex-start;"
											type="submit"
										>
											Submit review
										</button>
										{review.value && !review.value.ok ? (
											<div style="color: var(--danger); font-size: 0.9rem;">
												{review.value.message}
											</div>
										) : null}
									</Form>
								)}
							</div>
						</div>
					)}
				</section>
			</main>
			<Footer />
		</>
	);
});

export const head: DocumentHead = {
	title: "My account — Your Business",
	meta: [
		{
			name: "description",
			content: "Customer portal: jobs, quotes, invoices, and reviews.",
		},
	],
};
