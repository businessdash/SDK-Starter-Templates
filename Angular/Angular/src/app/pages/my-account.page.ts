import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from "@angular/core";
// [bd:saas]
import { computed } from "@angular/core";
// [/bd:saas]
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { BdSignInComponent } from "@businessdash/sdk/angular";
import { bdApi, type PortalMe } from "../lib/bd-api.client";

/** Where sign-in returns to: a path on this site, or the account page. */
function safeNext(raw: string | null): string {
	return raw?.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\")
		? raw
		: "/my-account";
}

/**
 * Customer portal. The auth handler (mounted at /api/bd-auth/*) sets an
 * httpOnly session cookie; the server reads it and returns the signed-in
 * user plus their work bundle (open jobs etc.) from `/api/bd/portal/me`.
 * Signed-out visitors get the business's own sign-in screen (<bd-sign-in>:
 * name, logo and brand colours from BD; password, emailed codes, and
 * "Continue with Google / Apple / GitHub / Discord" — WorkOS underneath,
 * through the handler). Signed-in customers can submit a review (reactive
 * form → `/api/bd/portal/review`).
 */
@Component({
	selector: "bd-my-account-page",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ReactiveFormsModule, BdSignInComponent],
	template: `
		<section class="section">
			<h1 class="section__title">My account</h1>

			@if (state() === "loading") {
				<p class="muted">Loading…</p>
			} @else if (!me()?.signedIn) {
				<bd-sign-in
					[start]="start"
					[redirectTo]="next"
					[brand]="{ tagline: 'Sign in to see your jobs, quotes, and invoices.' }"
				/>
			} @else if (me(); as m) {
				<p>
					Signed in as <strong>{{ m.user?.firstName || m.user?.email }}</strong>
					· <a href="/api/bd-auth/sign-out">Sign out</a>
					· <a href="/api/bd-auth/delete-account">Delete my account</a>
				</p>

				@if (m.work; as work) {
					@if (work.summary; as s) {
						<p class="muted">
							{{ s.openJobCount }} open jobs · {{ s.pendingQuoteCount }} quotes ·
							{{ s.unpaidInvoiceCount }} unpaid invoices
						</p>
					}
					@if (work.jobs.length > 0) {
						<h2 class="section__subtitle">Your jobs</h2>
						<ul class="post-list">
							@for (job of work.jobs; track job.id) {
								<li>
									<strong>{{ job.name || "Job" }}</strong>
									<span class="muted">{{ job.status }}</span>
								</li>
							}
						</ul>
					} @else if (work.unlinked) {
						<p class="muted">
							We couldn't match your email to a customer record yet — once we do, your jobs
							show up here.
						</p>
					}
				}

				<!-- [bd:saas] -->
				<h2 class="section__subtitle">Your plan</h2>
				@if (m.plan?.hasAccess) {
					<p>
						<strong>{{ m.plan?.plan?.name || "Subscription" }}</strong>
						<span class="muted"> · {{ cancelPending() ? "Cancelled" : "Active" }}</span>
					</p>
					@if (m.plan?.type === "lifetime") {
						<p class="muted">Yours for good. Nothing renews.</p>
					} @else {
						<p class="muted">{{ planLine() }}</p>
						<button class="bd-btn" type="button" [disabled]="planBusy()" (click)="togglePlan()">
							{{ cancelPending() ? "Keep my plan" : "Cancel plan" }}
						</button>
					}
				} @else {
					<p class="muted">You don't have a plan yet.</p>
					<a class="bd-btn" href="/subscriptions">See plans</a>
				}
				@if (planFailed()) {
					<p class="error">We couldn't change your plan. Please try again.</p>
				}
				<!-- [/bd:saas] -->

				<h2 class="section__subtitle">Leave a review</h2>
				@if (reviewStatus() === "sent") {
					<p class="muted">Thanks — your review is pending publication.</p>
				} @else {
					<form [formGroup]="reviewForm" (ngSubmit)="submitReview()">
						<label>
							Rating
							<select formControlName="rating">
								@for (n of [5, 4, 3, 2, 1]; track n) {
									<option [value]="n">{{ n }} ★</option>
								}
							</select>
						</label>
						<label>
							Title (optional)
							<input formControlName="title" />
						</label>
						<label>
							Your review
							<textarea formControlName="body" rows="3"></textarea>
						</label>
						<button class="bd-btn" type="submit" [disabled]="reviewForm.invalid || reviewStatus() === 'sending'">
							{{ reviewStatus() === "sending" ? "Sending…" : "Submit review" }}
						</button>
						@if (reviewStatus() === "error") {
							<p class="error">Couldn't submit. Please try again.</p>
						}
					</form>
				}
			}
		</section>
	`,
})
export class MyAccountPage implements OnInit {
	readonly me = signal<PortalMe | null>(null);
	private readonly query = inject(ActivatedRoute).snapshot.queryParamMap;
	readonly start =
		this.query.get("start") === "create"
			? ("createAccount" as const)
			: ("signIn" as const);
	readonly next = safeNext(this.query.get("next"));
	readonly state = signal<"loading" | "ready">("loading");
	readonly reviewStatus = signal<"idle" | "sending" | "sent" | "error">("idle");

	readonly reviewForm = new FormGroup({
		rating: new FormControl(5, { nonNullable: true, validators: [Validators.required] }),
		title: new FormControl("", { nonNullable: true }),
		body: new FormControl("", { nonNullable: true, validators: [Validators.required, Validators.minLength(1)] }),
	});

	async ngOnInit() {
		this.me.set(await bdApi.portalMe());
		this.state.set("ready");
	}

	// [bd:saas]
	// What just happened wins over the stored status, which lags until the
	// payment provider confirms.
	readonly planChange = signal<{ cancelAtPeriodEnd: boolean; accessUntil: string | null } | null>(
		null,
	);
	readonly planBusy = signal(false);
	readonly planFailed = signal(false);
	readonly cancelPending = computed(
		() => this.planChange()?.cancelAtPeriodEnd ?? this.me()?.plan?.cancelledButActive ?? false,
	);
	readonly planLine = computed(() => {
		const until = this.planChange()?.accessUntil ?? this.me()?.plan?.expiresAt ?? null;
		const date = until
			? new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(until))
			: null;
		if (this.cancelPending()) {
			return `It won't renew. You keep everything${date ? ` until ${date}` : ""}.`;
		}
		return date ? `Renews ${date}.` : "Renews automatically.";
	});

	async togglePlan() {
		this.planBusy.set(true);
		this.planFailed.set(false);
		const res = await bdApi.changePlan(this.cancelPending() ? "resume" : "cancel");
		this.planBusy.set(false);
		if (res) this.planChange.set(res);
		else this.planFailed.set(true);
	}
	// [/bd:saas]

	async submitReview() {
		if (this.reviewForm.invalid) return;
		this.reviewStatus.set("sending");
		const { rating, title, body } = this.reviewForm.getRawValue();
		const res = await bdApi.submitReview({
			rating: Number(rating),
			...(title ? { title } : {}),
			body,
		});
		this.reviewStatus.set(res?.ok ? "sent" : "error");
	}
}
