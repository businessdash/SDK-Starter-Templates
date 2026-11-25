import { BdSignIn } from "@businessdash/sdk/react";
import { useState } from "react";
import { bd } from "../lib/bd";
import type { Loose } from "../lib/bd";
// [bd:subscriptions]
import type { CustomerPlan } from "../lib/bd";
// [/bd:subscriptions]
import { ErrorBox, PageHead, useApi } from "./ui";

/** Where sign-in returns to: a path on this site, or the account page. */
function signInReturn(): string {
	const raw = new URLSearchParams(window.location.search).get("next") ?? "";
	return raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw : "/my-account";
}

export function MyAccount() {
	const { data, error, loading } = useApi(() => bd.portal.work());
	const [rating, setRating] = useState("5");
	const [body, setBody] = useState("");
	const [msg, setMsg] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const submit = async () => {
		if (!body.trim()) {
			setMsg("Please write a short review first.");
			return;
		}
		setSubmitting(true);
		setMsg("Submitting…");
		try {
			const res: Loose = await bd.portal.submitReview({ rating: Number(rating), body: body.trim() });
			setMsg(res?.status === "pending" ? "Thanks! Your review is pending moderation." : "Thanks for your review!");
			setBody("");
		} catch (e: any) {
			setMsg(e?.message ?? "Couldn't submit your review.");
		} finally {
			setSubmitting(false);
		}
	};

	if (loading)
		return (
			<main className="page">
				<PageHead title="My account" />
				<p className="muted">Loading…</p>
			</main>
		);
	if (error)
		return (
			<main className="page">
				<PageHead title="My account" />
				<ErrorBox error={error} />
			</main>
		);

	if (!data?.signedIn) {
		return (
			<main className="page">
				<PageHead title="My account" />
				<div className="signin-card">
					{/*
					 * The business's own sign-in screen (name, logo and brand colours
					 * from BD): password, emailed codes, and "Continue with Google /
					 * Apple / GitHub / Discord" — WorkOS underneath, through the Bun
					 * server's /api/bd-auth, which sets the session cookie.
					 */}
					<BdSignIn
						start={new URLSearchParams(window.location.search).get("start") === "create" ? "createAccount" : "signIn"}
						redirectTo={signInReturn()}
						brand={{ tagline: "Sign in to see your jobs and invoices." }}
					/>
				</div>
			</main>
		);
	}

	const u: Loose = data.user ?? {};
	const work: Loose = data.work ?? {};
	const jobs: Record<string, any>[] = work.jobs ?? work.items ?? [];

	return (
		<main className="page">
			<PageHead title="My account" />
			<div className="account-head">
				<p>
					Signed in as <strong>{u.firstName || u.email || "customer"}</strong>
				</p>
				<a className="btn btn--ghost btn--sm" href="/api/bd-auth/sign-out">
					Sign out
				</a>
			</div>
			<h2 className="section-title">Your work</h2>
			{jobs.length === 0 ? (
				<p className="muted">{work.unlinked ? "Your account isn't linked to any jobs yet." : "No jobs on file yet."}</p>
			) : (
				<ul className="job-list">
					{jobs.map((j, i) => (
						<li key={j.id ?? i} className="job-row">
							<span className="job-row__name">{j.name ?? j.title ?? j.jobName ?? "Job"}</span>
							{j.status ? <span className="job-row__status">{String(j.status)}</span> : null}
						</li>
					))}
				</ul>
			)}
			{/* [bd:subscriptions] */}
			<PlanCard plan={data.plan ?? null} />
			{/* [/bd:subscriptions] */}
			<section className="review-form">
				<h2 className="section-title">Leave a review</h2>
				<div className="rf__row">
					<select className="rf__rating" aria-label="Rating" value={rating} onChange={(e) => setRating(e.target.value)}>
						{[5, 4, 3, 2, 1].map((n) => (
							<option key={n} value={String(n)}>
								{n} ★
							</option>
						))}
					</select>
				</div>
				<textarea
					className="rf__text"
					rows={4}
					placeholder="Tell us about your experience…"
					value={body}
					onChange={(e) => setBody(e.target.value)}
				/>
				<button className="btn btn--primary" type="button" disabled={submitting} onClick={submit}>
					Submit review
				</button>
				<p className="rf__msg">{msg}</p>
			</section>
			<p className="muted">
				<a href="/api/bd-auth/delete-account">Delete my account</a>
			</p>
		</main>
	);
}

// [bd:subscriptions]
function formatDate(iso: string): string {
	return new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(iso));
}

/** The customer's plan, with Cancel, or Keep my plan while a cancel is pending. */
function PlanCard({ plan }: { plan: CustomerPlan | null }) {
	// What just happened wins over the stored status, which lags until the
	// payment provider confirms.
	const [change, setChange] = useState<{ cancelAtPeriodEnd: boolean; accessUntil: string | null } | null>(null);
	const [busy, setBusy] = useState(false);
	const [failure, setFailure] = useState("");
	const cancelPending = change?.cancelAtPeriodEnd ?? plan?.cancelledButActive ?? false;
	const until = change?.accessUntil ?? plan?.expiresAt ?? null;

	const toggle = async () => {
		setBusy(true);
		setFailure("");
		try {
			setChange(await bd.portal.changePlan(cancelPending ? "resume" : "cancel"));
		} catch {
			setFailure("We couldn't change your plan. Please try again.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<section className="review-form">
			<h2 className="section-title">Your plan</h2>
			{plan?.hasAccess ? (
				<>
					<p>
						<strong>{plan.plan?.name ?? "Subscription"}</strong> · {cancelPending ? "Cancelled" : "Active"}
					</p>
					{plan.type === "lifetime" ? (
						<p className="muted">Yours for good. Nothing renews.</p>
					) : (
						<>
							<p className="muted">
								{cancelPending
									? `It won't renew. You keep everything${until ? ` until ${formatDate(until)}` : ""}.`
									: until
										? `Renews ${formatDate(until)}.`
										: "Renews automatically."}
							</p>
							<button
								className={cancelPending ? "btn btn--primary" : "btn btn--ghost"}
								type="button"
								disabled={busy}
								onClick={toggle}
							>
								{cancelPending ? "Keep my plan" : "Cancel plan"}
							</button>
						</>
					)}
				</>
			) : (
				<>
					<p className="muted">You don't have a plan yet.</p>
					<a className="btn btn--primary" href="/subscriptions">
						See plans
					</a>
				</>
			)}
			{failure ? <p className="rf__msg">{failure}</p> : null}
		</section>
	);
}
// [/bd:subscriptions]
