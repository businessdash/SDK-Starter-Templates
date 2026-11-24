import { BdSignIn } from "@businessdash/sdk/react";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import type {
	ActionFunctionArgs,
	LoaderFunctionArgs,
	MetaFunction,
} from "react-router";

import { SiteHeader } from "~/components/SiteHeader";
import {
	getCustomerSession,
	getCustomerWork,
	isCustomerPortalConfigured,
	submitCustomerReview,
} from "~/lib/bd-portal.server";
// [bd:saas]
import {
	getCustomerSubscription,
	setPlanCancelled,
} from "~/lib/bd-portal.server";
// [/bd:saas]

/** Where sign-in returns to: a path on this site, or the account page. */
function safeNext(raw: string | null): string {
	return raw?.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\")
		? raw
		: "/my-account";
}

export const meta: MetaFunction = () => [
	{ title: "My account — Your Business" },
];

export async function loader({ request }: LoaderFunctionArgs) {
	const configured = isCustomerPortalConfigured();
	const session = await getCustomerSession(request);
	if (!session) {
		const params = new URL(request.url).searchParams;
		const start = params.get("start");
		return {
			configured,
			signedIn: false as const,
			start: start === "create" ? ("createAccount" as const) : ("signIn" as const),
			next: safeNext(params.get("next")),
		};
	}
	const work = await getCustomerWork(request);
	// [bd:saas]
	const plan = (await getCustomerSubscription(request))?.subscription ?? null;
	// [/bd:saas]
	return {
		configured,
		signedIn: true as const,
		user: session.user,
		// [bd:saas]
		plan,
		// [/bd:saas]
		unlinked: work?.unlinked ?? true,
		summary: work?.summary ?? null,
		jobs: (work?.jobs ?? []).slice(0, 10).map((j) => {
			const job = j as Record<string, unknown>;
			return {
				id: typeof job["id"] === "string" ? (job["id"] as string) : "",
				title:
					typeof job["title"] === "string"
						? (job["title"] as string)
						: typeof job["name"] === "string"
							? (job["name"] as string)
							: "Job",
				status:
					typeof job["status"] === "string" ? (job["status"] as string) : "",
			};
		}),
	};
}

export async function action({ request }: ActionFunctionArgs) {
	const fd = await request.formData();
	// [bd:saas]
	const intent = fd.get("intent");
	if (intent === "cancelPlan" || intent === "resumePlan") {
		try {
			const res = await setPlanCancelled(request, intent === "cancelPlan");
			return {
				status: "plan" as const,
				cancelAtPeriodEnd: res.cancelAtPeriodEnd,
				accessUntil: res.accessUntil,
			};
		} catch {
			return {
				status: "planError" as const,
				message: "We couldn't change your plan. Please try again.",
			};
		}
	}
	// [/bd:saas]
	const rating = Number.parseInt(String(fd.get("rating") ?? "5"), 10);
	const title = (String(fd.get("title") ?? "").trim() || undefined) as
		| string
		| undefined;
	const body = String(fd.get("body") ?? "").trim();
	const jobId = (String(fd.get("jobId") ?? "").trim() || undefined) as
		| string
		| undefined;
	if (!body) {
		return { status: "error" as const, message: "Please write a few words." };
	}
	try {
		const res = await submitCustomerReview(request, {
			rating: Math.min(5, Math.max(1, rating)),
			title,
			body,
			jobId,
		});
		return {
			status: "success" as const,
			message: "Thanks! Your review will appear once approved.",
			reviewStatus: res.status,
		};
	} catch {
		return {
			status: "error" as const,
			message:
				"We couldn't submit your review. You may need to sign in again.",
		};
	}
}

export default function MyAccount() {
	const data = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const nav = useNavigation();
	const submitting = nav.state === "submitting";

	return (
		<>
			<SiteHeader />
			<main>
				<section className="section">
					<h1 className="section__title">My account</h1>

					{!data.configured ? (
						<p className="muted">
							Customer accounts aren't connected yet. Set the BD API key and
							base URL to enable sign-in.
						</p>
					) : !data.signedIn ? (
						<div className="card">
							{/*
							 * The business's own sign-in screen (name, logo and brand
							 * colours from BD): password, emailed codes, and "Continue
							 * with Google / Apple / GitHub / Discord" — WorkOS
							 * underneath, through /api/bd-auth, which sets the
							 * session cookie. Mounts in the browser.
							 */}
							<BdSignIn
								start={data.start}
								redirectTo={data.next}
								brand={{ tagline: "Sign in to see your jobs and invoices." }}
							/>
						</div>
					) : (
						<>
							<div className="card">
								<h3>
									{data.user.firstName ?? ""} {data.user.lastName ?? ""}
								</h3>
								<p className="muted">{data.user.email}</p>
								<p>
									<a className="muted" href="/api/bd-auth/sign-out">
										Sign out
									</a>
									{" · "}
									<a className="muted" href="/api/bd-auth/delete-account">
										Delete my account
									</a>
								</p>
							</div>

							<h2 className="section__subtitle">Your work</h2>
							{data.unlinked ? (
								<p className="muted">
									Your account isn't linked to a customer record yet. New jobs
									and invoices will show here once it is.
								</p>
							) : (
								<>
									{data.summary ? (
										<ul className="stat-row">
											<li>Open jobs: {data.summary.openJobCount}</li>
											<li>Pending quotes: {data.summary.pendingQuoteCount}</li>
											<li>Unpaid invoices: {data.summary.unpaidInvoiceCount}</li>
										</ul>
									) : null}
									{data.jobs.length > 0 ? (
										<ul className="post-list">
											{data.jobs.map((j) => (
												<li key={j.id}>
													<strong>{j.title}</strong>
													{j.status ? (
														<span className="muted"> · {j.status}</span>
													) : null}
												</li>
											))}
										</ul>
									) : (
										<p className="muted">No jobs yet.</p>
									)}
								</>
							)}

							{/* [bd:saas] */}
							<h2 className="section__subtitle">Your plan</h2>
							<PlanCard
								plan={data.plan}
								change={
									actionData?.status === "plan" ||
									actionData?.status === "planError"
										? actionData
										: null
								}
							/>
							{/* [/bd:saas] */}

							<h2 className="section__subtitle">Leave a review</h2>
							{actionData?.status === "success" ? (
								<p className="muted">{actionData.message}</p>
							) : (
								<Form method="post">
									<label>
										Rating
										<select name="rating" defaultValue="5">
											{[5, 4, 3, 2, 1].map((n) => (
												<option value={n} key={n}>
													{n} star{n === 1 ? "" : "s"}
												</option>
											))}
										</select>
									</label>
									<label>
										Title (optional)
										<input name="title" />
									</label>
									<label>
										Your review
										<textarea name="body" rows={4} required />
									</label>
									{data.jobs.length > 0 ? (
										<label>
											About a job (optional)
											<select name="jobId" defaultValue="">
												<option value="">— none —</option>
												{data.jobs.map((j) => (
													<option value={j.id} key={j.id}>
														{j.title}
													</option>
												))}
											</select>
										</label>
									) : null}
									<button className="bd-btn" type="submit" disabled={submitting}>
										{submitting ? "Submitting…" : "Submit review"}
									</button>
									{actionData?.status === "error" ? (
										<p className="error">{actionData.message}</p>
									) : null}
								</Form>
							)}
						</>
					)}
				</section>
			</main>
		</>
	);
}

// [bd:saas]
type Plan = NonNullable<
	Awaited<ReturnType<typeof getCustomerSubscription>>
>["subscription"];
type PlanChange =
	| { status: "plan"; cancelAtPeriodEnd: boolean; accessUntil: string | null }
	| { status: "planError"; message: string };

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(
		new Date(iso),
	);
}

/** The customer's plan, with Cancel, or Keep my plan while a cancel is pending. */
function PlanCard({ plan, change }: { plan: Plan; change: PlanChange | null }) {
	if (!plan?.hasAccess) {
		return (
			<div className="card">
				<p className="muted">You don't have a plan yet.</p>
				<a className="bd-btn" href="/store/subscriptions">
					See plans
				</a>
			</div>
		);
	}
	// What just happened wins over the stored status, which lags until the
	// payment provider confirms.
	const cancelPending =
		change?.status === "plan" ? change.cancelAtPeriodEnd : plan.cancelledButActive;
	const until =
		(change?.status === "plan" ? change.accessUntil : null) ?? plan.expiresAt;
	return (
		<div className="card">
			<h3>
				{plan.plan?.name ?? "Subscription"}{" "}
				<span className="muted">· {cancelPending ? "Cancelled" : "Active"}</span>
			</h3>
			{plan.type === "lifetime" ? (
				<p className="muted">Yours for good. Nothing renews.</p>
			) : cancelPending ? (
				<>
					<p className="muted">
						It won't renew. You keep everything
						{until ? ` until ${formatDate(until)}` : ""}.
					</p>
					<Form method="post">
						<input type="hidden" name="intent" value="resumePlan" />
						<button className="bd-btn" type="submit">
							Keep my plan
						</button>
					</Form>
				</>
			) : (
				<>
					<p className="muted">
						{until ? `Renews ${formatDate(until)}.` : "Renews automatically."}
					</p>
					<Form method="post">
						<input type="hidden" name="intent" value="cancelPlan" />
						<button className="bd-btn" type="submit">
							Cancel plan
						</button>
					</Form>
				</>
			)}
			{change?.status === "planError" ? (
				<p className="error">{change.message}</p>
			) : null}
		</div>
	);
}
// [/bd:saas]
