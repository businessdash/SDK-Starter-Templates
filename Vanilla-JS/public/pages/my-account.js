/** /my-account — customer portal: session, work bundle, review submission. */
import { bd, el } from "/bd.js";
import { errBox, pageHead } from "./_ui.js";

export default async function render(root) {
	root.replaceChildren(pageHead("My account"), el("p", { class: "page__loading" }, ["Loading…"]));
	let data;
	try {
		data = await bd.portal.work();
	} catch (err) {
		root.replaceChildren(pageHead("My account"), errBox(err));
		return;
	}

	const nodes = [pageHead("My account")];

	if (!data?.signedIn) {
		// The business's own sign-in screen (name, logo and brand colours from
		// BD): password, emailed codes, and "Continue with Google / Apple /
		// GitHub / Discord" — WorkOS underneath, through the server's
		// /api/bd-auth, which sets the session cookie.
		const { mountBdSignIn } = await import("/_sdk/sign-in.js");
		const card = el("div", { class: "signin-card" });
		nodes.push(card);
		root.replaceChildren(...nodes);
		mountBdSignIn(card, {
			start: new URLSearchParams(location.search).get("start") === "create" ? "createAccount" : "signIn",
			redirectTo: signInReturn(),
			brand: { tagline: "Sign in to see your jobs and invoices." },
		});
		return;
	}

	const u = data.user ?? {};
	nodes.push(
		el("div", { class: "account-head" }, [
			el("p", {}, ["Signed in as ", el("strong", {}, [u.firstName || u.email || "customer"])]),
			el("a", { class: "btn btn--ghost btn--sm", href: "/api/bd-auth/sign-out" }, ["Sign out"]),
		]),
	);

	const work = data.work ?? {};
	const jobs = work.jobs ?? work.items ?? [];
	nodes.push(el("h2", { class: "section-title" }, ["Your work"]));
	if (!jobs.length) {
		nodes.push(
			el("p", { class: "muted" }, [work.unlinked ? "Your account isn't linked to any jobs yet." : "No jobs on file yet."]),
		);
	} else {
		nodes.push(el("ul", { class: "job-list" }, jobs.map(jobRow)));
	}

	// [bd:saas]
	nodes.push(planSection(data.plan ?? null));
	// [/bd:saas]
	nodes.push(reviewForm());
	nodes.push(el("p", { class: "muted" }, [el("a", { href: "/api/bd-auth/delete-account" }, ["Delete my account"])]));
	root.replaceChildren(...nodes);
}

/** Where sign-in returns to: a path on this site, or the account page. */
function signInReturn() {
	const raw = new URLSearchParams(location.search).get("next") ?? "";
	return raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw : "/my-account";
}

// [bd:saas]
function formatDate(iso) {
	return new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(iso));
}

/** The customer's plan, with Cancel, or Keep my plan while a cancel is pending. */
function planSection(plan) {
	const section = el("section", { class: "review-form" }, []);
	// What just happened wins over the stored status, which lags until the
	// payment provider confirms.
	let cancelPending = plan?.cancelledButActive ?? false;
	let until = plan?.expiresAt ?? null;

	function draw() {
		const head = el("h2", { class: "section-title" }, ["Your plan"]);
		if (!plan?.hasAccess) {
			section.replaceChildren(
				head,
				el("p", { class: "muted" }, ["You don't have a plan yet."]),
				el("a", { class: "btn btn--primary", href: "/subscriptions" }, ["See plans"]),
			);
			return;
		}
		const name = el("p", {}, [
			el("strong", {}, [plan.plan?.name ?? "Subscription"]),
			` · ${cancelPending ? "Cancelled" : "Active"}`,
		]);
		if (plan.type === "lifetime") {
			section.replaceChildren(head, name, el("p", { class: "muted" }, ["Yours for good. Nothing renews."]));
			return;
		}
		const line = cancelPending
			? `It won't renew. You keep everything${until ? ` until ${formatDate(until)}` : ""}.`
			: until
				? `Renews ${formatDate(until)}.`
				: "Renews automatically.";
		const msg = el("p", { class: "rf__msg" }, []);
		const btn = el(
			"button",
			{
				class: cancelPending ? "btn btn--primary" : "btn btn--ghost",
				type: "button",
				onClick: async () => {
					btn.disabled = true;
					try {
						const res = await bd.portal.changePlan(cancelPending ? "resume" : "cancel");
						cancelPending = res.cancelAtPeriodEnd;
						until = res.accessUntil ?? until;
						draw();
					} catch {
						msg.textContent = "We couldn't change your plan. Please try again.";
						btn.disabled = false;
					}
				},
			},
			[cancelPending ? "Keep my plan" : "Cancel plan"],
		);
		section.replaceChildren(head, name, el("p", { class: "muted" }, [line]), btn, msg);
	}

	draw();
	return section;
}
// [/bd:saas]

function jobRow(j) {
	return el("li", { class: "job-row" }, [
		el("span", { class: "job-row__name" }, [j.name ?? j.title ?? j.jobName ?? "Job"]),
		j.status ? el("span", { class: "job-row__status" }, [String(j.status)]) : null,
	]);
}

function reviewForm() {
	const rating = el(
		"select",
		{ class: "rf__rating", "aria-label": "Rating" },
		[5, 4, 3, 2, 1].map((n) => el("option", { value: String(n) }, [`${n} ★`])),
	);
	const text = el("textarea", { class: "rf__text", rows: "4", placeholder: "Tell us about your experience…" });
	const msg = el("p", { class: "rf__msg" }, []);
	const btn = el(
		"button",
		{
			class: "btn btn--primary",
			type: "button",
			onClick: async () => {
				if (!text.value.trim()) {
					msg.textContent = "Please write a short review first.";
					return;
				}
				btn.disabled = true;
				msg.textContent = "Submitting…";
				try {
					const res = await bd.portal.submitReview({ rating: Number(rating.value), body: text.value.trim() });
					msg.textContent =
						res?.status === "pending"
							? "Thanks! Your review is pending moderation."
							: "Thanks for your review!";
					text.value = "";
				} catch (err) {
					msg.textContent = err?.message ?? "Couldn't submit your review.";
				} finally {
					btn.disabled = false;
				}
			},
		},
		["Submit review"],
	);
	return el("section", { class: "review-form" }, [
		el("h2", { class: "section-title" }, ["Leave a review"]),
		el("div", { class: "rf__row" }, [rating]),
		text,
		btn,
		msg,
	]);
}
