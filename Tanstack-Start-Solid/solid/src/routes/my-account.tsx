import { createFileRoute } from "@tanstack/solid-router";
import { createSignal, Show } from "solid-js";

import { getMyAccount, submitCustomerReview } from "../lib/bd-server-fns";

/**
 * Customer portal home. The loader reads the `bd_session` cookie via
 * `getTenantSession` and, when signed in, pulls the customer's work
 * bundle (`getWork()`). Sign-in / sign-up / sign-out are plain links to
 * the `/api/bd-auth/*` catch-all handler — no client SDK needed. A
 * signed-in customer can submit a review (lands pending for moderation).
 */
export const Route = createFileRoute("/my-account")({
	component: MyAccount,
	loader: () => getMyAccount(),
});

function MyAccount() {
	const data = Route.useLoaderData();
	const session = () => data().session;
	const work = () => data().work;

	return (
		<main>
			<section class="bd-section bd-section--narrow">
				<div class="bd-section__lead">
					<span class="bd-section__eyebrow">Account</span>
					<h1 class="bd-section__title">My account</h1>
				</div>

				<Show
					when={data().configured}
					fallback={
						<div class="bd-empty">
							Customer accounts aren't connected yet. Set{" "}
							<code>BD_AUTH_CALLBACK_URL</code> (plus the BD API key + base
							URL) in <code>.env</code>.
						</div>
					}
				>
					<Show
						when={session()}
						fallback={
							<div
								class="bd-card"
								style="padding: 2rem; text-align: center; display: flex; flex-direction: column; gap: 1rem; align-items: center;"
							>
								<p>Sign in to view your jobs, quotes, and invoices.</p>
								<div style="display: flex; gap: 0.75rem;">
									<a class="bd-btn" href="/api/bd-auth/sign-in">
										Sign in
									</a>
									<a
										class="bd-btn bd-btn--ghost"
										href="/api/bd-auth/sign-up"
									>
										Create account
									</a>
								</div>
							</div>
						}
					>
						<div
							class="bd-card"
							style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem;"
						>
							<div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
								<div>
									<div style="font-weight: 700; color: var(--title);">
										{[session()?.firstName, session()?.lastName]
											.filter(Boolean)
											.join(" ") ||
											session()?.email ||
											"Signed in"}
									</div>
									<Show when={session()?.email}>
										<div style="font-size: 0.85rem; color: var(--text-muted);">
											{session()?.email}
										</div>
									</Show>
								</div>
								<a
									class="bd-btn bd-btn--ghost"
									href="/api/bd-auth/sign-out"
								>
									Sign out
								</a>
							</div>

							<WorkSummary work={work()} />
						</div>

						<ReviewForm />
					</Show>
				</Show>
			</section>
		</main>
	);
}

function WorkSummary(props: { work: unknown }) {
	const w = props.work as {
		unlinked?: boolean;
		summary?: {
			openJobCount: number;
			pendingQuoteCount: number;
			unpaidInvoiceCount: number;
			awaitingSignatureCount: number;
		};
	} | null;
	return (
		<Show
			when={w && !w.unlinked}
			fallback={
				<div class="bd-empty" style="margin: 0;">
					No work records are linked to this account yet.
				</div>
			}
		>
			<div class="bd-grid-4">
				<Stat label="Open jobs" value={w?.summary?.openJobCount ?? 0} />
				<Stat
					label="Pending quotes"
					value={w?.summary?.pendingQuoteCount ?? 0}
				/>
				<Stat
					label="Unpaid invoices"
					value={w?.summary?.unpaidInvoiceCount ?? 0}
				/>
				<Stat
					label="Awaiting signature"
					value={w?.summary?.awaitingSignatureCount ?? 0}
				/>
			</div>
		</Show>
	);
}

function Stat(props: { label: string; value: number }) {
	return (
		<div class="bd-card" style="padding: 1rem; text-align: center;">
			<div style="font-size: 1.6rem; font-weight: 800; color: var(--accent);">
				{props.value}
			</div>
			<div style="font-size: 0.8rem; color: var(--text-muted);">
				{props.label}
			</div>
		</div>
	);
}

function ReviewForm() {
	const [rating, setRating] = createSignal(5);
	const [title, setTitle] = createSignal("");
	const [body, setBody] = createSignal("");
	const [busy, setBusy] = createSignal(false);
	const [done, setDone] = createSignal<string | null>(null);
	const [error, setError] = createSignal<string | null>(null);

	async function submit(e: Event) {
		e.preventDefault();
		if (!body().trim()) {
			setError("Please write a few words.");
			return;
		}
		setBusy(true);
		setError(null);
		const res = await submitCustomerReview({
			data: { rating: rating(), title: title() || undefined, body: body() },
		});
		setBusy(false);
		if (res.ok) {
			setDone(
				`Thanks! Your review was submitted (${res.status}) and will appear once approved.`,
			);
			setBody("");
			setTitle("");
		} else {
			setError(res.error);
		}
	}

	return (
		<div class="bd-card" style="padding: 1.5rem; margin-top: 1.5rem;">
			<h2 style="font-size: 1.15rem; margin-bottom: 1rem;">Leave a review</h2>
			<Show
				when={!done()}
				fallback={
					<div style="color: var(--success); background: var(--success-bg); padding: 0.75rem 1rem; border-radius: 0.5rem; font-size: 0.9rem;">
						{done()}
					</div>
				}
			>
				<form
					onSubmit={submit}
					style="display: flex; flex-direction: column; gap: 1rem;"
				>
					<div>
						<label class="bd-label" for="rating">
							Rating
						</label>
						<select
							id="rating"
							class="bd-select"
							value={String(rating())}
							onChange={(e) => setRating(Number(e.currentTarget.value))}
						>
							<option value="5">★★★★★ (5)</option>
							<option value="4">★★★★ (4)</option>
							<option value="3">★★★ (3)</option>
							<option value="2">★★ (2)</option>
							<option value="1">★ (1)</option>
						</select>
					</div>
					<div>
						<label class="bd-label" for="review-title">
							Title (optional)
						</label>
						<input
							id="review-title"
							class="bd-input"
							value={title()}
							onInput={(e) => setTitle(e.currentTarget.value)}
						/>
					</div>
					<div>
						<label class="bd-label" for="review-body">
							Your review
						</label>
						<textarea
							id="review-body"
							class="bd-textarea"
							value={body()}
							onInput={(e) => setBody(e.currentTarget.value)}
						/>
					</div>
					<button type="submit" class="bd-btn" disabled={busy()}>
						{busy() ? "Submitting…" : "Submit review"}
					</button>
					<Show when={error()}>
						<div style="color: var(--danger); background: var(--danger-bg); padding: 0.75rem 1rem; border-radius: 0.5rem; font-size: 0.9rem;">
							{error()}
						</div>
					</Show>
				</form>
			</Show>
		</div>
	);
}
