import { BdSignIn } from "@businessdash/sdk/solid";
import { createFileRoute } from "@tanstack/solid-router";
import { createSignal, Show } from "solid-js";

import { getMyAccount, submitCustomerReview } from "../lib/bd-server-fns";
// [bd:subscriptions]
import { changePlan, type MyAccountData } from "../lib/bd-server-fns";
// [/bd:subscriptions]

/** Where sign-in returns to: a path on this site. */
function safeNext(raw: unknown): string | undefined {
	return typeof raw === "string" &&
		raw.startsWith("/") &&
		!raw.startsWith("//") &&
		!raw.startsWith("/\\")
		? raw
		: undefined;
}

/**
 * Customer portal home. The loader reads the `bd_session` cookie via
 * `getTenantSession` and, when signed in, pulls the customer's work
 * bundle (`getWork()`). Signed out, it shows the business's own sign-in
 * screen (`<BdSignIn>`: name, logo and brand colours from BD; password,
 * emailed codes, and "Continue with Google / Apple / GitHub / Discord" —
 * WorkOS underneath, through the `/api/bd-auth/*` handler, which sets the
 * cookie). A signed-in customer can submit a review (lands pending for
 * moderation).
 */
export const Route = createFileRoute("/my-account")({
	component: MyAccount,
	validateSearch: (
		search: Record<string, unknown>,
	): { start?: "create"; next?: string } => {
		const next = safeNext(search.next);
		return {
			...(search.start === "create" ? { start: "create" as const } : {}),
			...(next ? { next } : {}),
		};
	},
	loader: () => getMyAccount(),
});

function MyAccount() {
	const data = Route.useLoaderData();
	const session = () => data().session;
	const work = () => data().work;
	const search = Route.useSearch();

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
							Customer accounts aren't connected yet. Set the BD API key and
							base URL in <code>.env</code>.
						</div>
					}
				>
					<Show
						when={session()}
						fallback={
							<div class="bd-card" style="padding: 2rem 1.25rem;">
								<BdSignIn
									start={search().start === "create" ? "createAccount" : "signIn"}
									redirectTo={search().next ?? "/my-account"}
									brand={{
										tagline: "Sign in to view your jobs, quotes, and invoices.",
									}}
								/>
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

						{/* [bd:subscriptions] */}
						<PlanCard plan={data().plan} />
						{/* [/bd:subscriptions] */}

						<ReviewForm />

						<p style="margin-top: 2rem; font-size: 0.875rem;">
							<a href="/api/bd-auth/delete-account" style="color: var(--text-muted);">
								Delete my account
							</a>
						</p>
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

// [bd:subscriptions]
function formatDate(iso: string): string {
	return new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(
		new Date(iso),
	);
}

/** The customer's plan, with Cancel, or Keep my plan while a cancel is pending. */
function PlanCard(props: { plan: MyAccountData["plan"] }) {
	// What just happened wins over the stored status, which lags until the
	// payment provider confirms.
	const [change, setChange] = createSignal<{
		cancelAtPeriodEnd: boolean;
		accessUntil: string | null;
	} | null>(null);
	const [busy, setBusy] = createSignal(false);
	const [error, setError] = createSignal<string | null>(null);
	const cancelPending = () =>
		change()?.cancelAtPeriodEnd ?? props.plan?.cancelledButActive ?? false;
	const until = () => change()?.accessUntil ?? props.plan?.expiresAt ?? null;

	async function toggle() {
		setBusy(true);
		setError(null);
		const res = await changePlan({ data: { cancel: !cancelPending() } });
		setBusy(false);
		if (res.ok) {
			setChange({
				cancelAtPeriodEnd: res.cancelAtPeriodEnd,
				accessUntil: res.accessUntil,
			});
		} else {
			setError(res.error);
		}
	}

	return (
		<div
			class="bd-card"
			style="padding: 1.5rem; margin-top: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem; align-items: flex-start;"
		>
			<h2 style="font-size: 1.15rem;">Your plan</h2>
			<Show
				when={props.plan?.hasAccess}
				fallback={
					<>
						<p style="color: var(--text-muted);">You don't have a plan yet.</p>
						<a class="bd-btn" href="/subscriptions">
							See plans
						</a>
					</>
				}
			>
				<div style="font-weight: 700; color: var(--title);">
					{props.plan?.plan?.name ?? "Subscription"}{" "}
					<span class="bd-badge">{cancelPending() ? "Cancelled" : "Active"}</span>
				</div>
				<Show
					when={props.plan?.type !== "lifetime"}
					fallback={
						<p style="color: var(--text-muted);">Yours for good. Nothing renews.</p>
					}
				>
					<p style="color: var(--text-muted);">
						{cancelPending()
							? `It won't renew. You keep everything${until() ? ` until ${formatDate(until() ?? "")}` : ""}.`
							: until()
								? `Renews ${formatDate(until() ?? "")}.`
								: "Renews automatically."}
					</p>
					<button
						type="button"
						class={cancelPending() ? "bd-btn" : "bd-btn bd-btn--ghost"}
						disabled={busy()}
						onClick={toggle}
					>
						{cancelPending() ? "Keep my plan" : "Cancel plan"}
					</button>
				</Show>
			</Show>
			<Show when={error()}>
				<div style="color: var(--danger); font-size: 0.9rem;">{error()}</div>
			</Show>
		</div>
	);
}
// [/bd:subscriptions]
