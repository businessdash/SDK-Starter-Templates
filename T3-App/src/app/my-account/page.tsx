import type { CustomerJobSummary } from "@businessdash/sdk/contracts";
import type { Metadata } from "next";

import { SignOutLink } from "@/app/_components/bd/AuthButtons";
import { SignInScreen } from "@/app/_components/bd/SignInScreen";
import { BdFooter } from "@/app/_components/bd/Footer";
import { ReviewForm } from "@/app/_components/bd/ReviewForm";
import {
	getCustomerSession,
	getCustomerWork,
	isCustomerPortalConfigured,
} from "@/server/lib/bd-portal";
// [bd:subscriptions]
import { changePlanAction } from "@/app/_actions/plans";
import { getCustomerSubscription } from "@/server/lib/bd-portal";
// [/bd:subscriptions]

export const metadata: Metadata = {
	title: "My Account",
	description: "Your jobs, quotes, and invoices.",
};

// Per-customer + reads the `bd_session` cookie — never statically cache.
export const dynamic = "force-dynamic";

function formatDate(iso: string | null): string | null {
	if (!iso) return null;
	const t = Date.parse(iso);
	if (Number.isNaN(t)) return null;
	return new Date(t).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function prettyStatus(status: string): string {
	return status.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function JobCard({
	job,
	completed,
}: {
	job: CustomerJobSummary;
	completed: boolean;
}) {
	const started = formatDate(job.startDate);
	const due = formatDate(job.dueDate);
	const done = formatDate(job.statusCompletedAt);
	return (
		<li className="bd-card account-job">
			<div className="account-job__head">
				<div>
					<h3>{job.name?.trim() || "Service job"}</h3>
					<p className="account-job__meta">
						{prettyStatus(job.status)}
						{done
							? ` · Completed ${done}`
							: started
								? ` · Started ${started}`
								: ""}
						{!completed && due ? ` · Due ${due}` : ""}
					</p>
				</div>
				<span className={`bd-badge ${completed ? "" : "bd-badge--active"}`}>
					{completed ? "Completed" : "In progress"}
				</span>
			</div>

			<details className="account-job__review">
				<summary>★ Leave a review</summary>
				<div>
					<ReviewForm jobId={job.id} />
				</div>
			</details>
		</li>
	);
}

export default async function MyAccountPage({
	searchParams,
}: {
	searchParams: Promise<{ start?: string; next?: string; plan?: string }>;
}) {
	const { start, next, plan } = await searchParams;
	// Where sign-in returns to: a path on this site, or the account page.
	const redirectTo =
		next?.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
			? next
			: "/my-account";
	const configured = isCustomerPortalConfigured();
	const session = configured ? await getCustomerSession() : null;

	return (
		<>
			<main className="bd-section bd-section--narrow account">
				<div className="account__head">
					<div>
						<span className="bd-section__eyebrow">Account</span>
						<h1 className="bd-section__title">My account</h1>
						<p className="bd-section__sub">
							{session?.user.firstName
								? `Welcome back, ${session.user.firstName}.`
								: "Your jobs, quotes, and invoices live here."}
						</p>
					</div>
					{session ? <SignOutLink /> : null}
				</div>

				{!configured ? (
					<div className="bd-empty">
						Accounts aren&apos;t available right now — set the BD API key
						and base URL to enable customer sign-in.
					</div>
				) : !session ? (
					<div className="bd-card account__signedout">
						<SignInScreen
							redirectTo={redirectTo}
							start={start === "create" ? "createAccount" : "signIn"}
						/>
					</div>
				) : (
					<>
						{/* [bd:subscriptions] */}
						<PlanSection result={plan} />
						{/* [/bd:subscriptions] */}
						<AccountWork />
						<p className="account__delete">
							<a href="/api/bd-auth/delete-account">Delete my account</a>
						</p>
					</>
				)}
			</main>
			<BdFooter />
		</>
	);
}

async function AccountWork() {
	const work = await getCustomerWork();
	const jobs = work?.jobs ?? [];
	const current = jobs.filter((j) => !j.statusCompletedAt);
	const former = jobs.filter((j) => j.statusCompletedAt);

	if (work?.unlinked) {
		return (
			<div className="bd-empty">
				We couldn&apos;t find any jobs linked to your account yet. Once
				we&apos;ve started work for you, it&apos;ll show up here.
			</div>
		);
	}

	if (jobs.length === 0) {
		return <div className="bd-empty">You don&apos;t have any jobs yet.</div>;
	}

	return (
		<div className="account__work">
			{current.length > 0 ? (
				<section>
					<h2 className="account__sectionTitle">Current jobs</h2>
					<ul className="account__list">
						{current.map((job) => (
							<JobCard completed={false} job={job} key={job.id} />
						))}
					</ul>
				</section>
			) : null}

			{former.length > 0 ? (
				<section>
					<h2 className="account__sectionTitle">Past jobs</h2>
					<ul className="account__list">
						{former.map((job) => (
							<JobCard completed={true} job={job} key={job.id} />
						))}
					</ul>
				</section>
			) : null}
		</div>
	);
}

// [bd:subscriptions]
/**
 * The customer's plan, with Cancel, or Keep my plan while a cancel is pending.
 * `result` is what the last change did; it wins over the stored status,
 * which lags until the payment provider confirms.
 */
async function PlanSection({ result }: { result?: string }) {
	const plan = (await getCustomerSubscription())?.subscription ?? null;
	const cancelPending =
		result === "cancelled"
			? true
			: result === "resumed"
				? false
				: (plan?.cancelledButActive ?? false);
	const until = formatDate(plan?.expiresAt ?? null);
	return (
		<section>
			<h2 className="account__sectionTitle">Your plan</h2>
			<div className="bd-card account-job">
				{plan?.hasAccess ? (
					<>
						<div className="account-job__head">
							<h3>{plan.plan?.name ?? "Subscription"}</h3>
							<span
								className={`bd-badge ${cancelPending ? "" : "bd-badge--active"}`}
							>
								{cancelPending ? "Cancelled" : "Active"}
							</span>
						</div>
						{plan.type === "lifetime" ? (
							<p className="account-job__meta">Yours for good. Nothing renews.</p>
						) : (
							<>
								<p className="account-job__meta">
									{cancelPending
										? `It won't renew. You keep everything${until ? ` until ${until}` : ""}.`
										: until
											? `Renews ${until}.`
											: "Renews automatically."}
								</p>
								<form action={changePlanAction}>
									<input
										name="intent"
										type="hidden"
										value={cancelPending ? "resume" : "cancel"}
									/>
									<button
										className={cancelPending ? "bd-btn" : "bd-btn bd-btn--ghost"}
										type="submit"
									>
										{cancelPending ? "Keep my plan" : "Cancel plan"}
									</button>
								</form>
							</>
						)}
					</>
				) : (
					<>
						<p className="account-job__meta">You don&apos;t have a plan yet.</p>
						<a className="bd-btn" href="/store/subscriptions">
							See plans
						</a>
					</>
				)}
				{result === "error" ? (
					<p className="account-job__meta">
						We couldn&apos;t change your plan. Please try again.
					</p>
				) : null}
			</div>
		</section>
	);
}
// [/bd:subscriptions]
