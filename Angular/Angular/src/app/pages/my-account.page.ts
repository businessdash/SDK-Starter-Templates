import { ChangeDetectionStrategy, Component, OnInit, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { bdApi, type PortalMe } from "../lib/bd-api.client";

/**
 * Customer portal. The auth handler (mounted at /api/bd-auth/*) sets an
 * httpOnly session cookie; the server reads it and returns the signed-in
 * user plus their work bundle (open jobs etc.) from `/api/bd/portal/me`.
 * Signed-out visitors get sign-in / sign-up links (plain hrefs — the handler
 * 302s through WorkOS). Signed-in customers can submit a review (reactive
 * form → `/api/bd/portal/review`).
 */
@Component({
	selector: "bd-my-account-page",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ReactiveFormsModule],
	template: `
		<section class="section">
			<h1 class="section__title">My account</h1>

			@if (state() === "loading") {
				<p class="muted">Loading…</p>
			} @else if (!me()?.signedIn) {
				<p class="muted">Sign in to see your jobs, quotes, and invoices.</p>
				<p class="account-links">
					<a class="bd-btn" href="/api/bd-auth/sign-in">Sign in</a>
					<a class="bd-btn bd-btn--ghost" href="/api/bd-auth/sign-up">Create account</a>
				</p>
			} @else if (me(); as m) {
				<p>
					Signed in as <strong>{{ m.user?.firstName || m.user?.email }}</strong>
					· <a href="/api/bd-auth/sign-out">Sign out</a>
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
