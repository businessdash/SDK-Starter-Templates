/**
 * `<bd-review-writer>`: a signed-in customer writes a review of the business.
 * It goes to the business to approve before it shows. Signed out, it's a
 * link to sign in.
 *
 *   <bd-review-writer data-write-url="/reviews/write" data-sign-in-href="/my-account">
 *     <script type="application/json">{"signedIn": true}</script>
 *   </bd-review-writer>
 *
 * The server route checks the review again (`checkReview`) and sends it with
 * the customer's session; it answers `{ ok: true }` or `{ error }`.
 */
import { define, h, patch, postJson, readJson, upgradeProperty } from "./bd-dom";
import { checkReview, REVIEW_MAX_LENGTH, REVIEW_SENT } from "./reviews";

// For the reviews page module (public/pages/reviews.js), which draws the
// reviews with the same rules.
export {
	formatReviewDate,
	platformName,
	reviewerInitial,
	reviewerName,
	reviewLink,
	reviewStars,
	safeImage,
	sourceLabel,
} from "./reviews";

class ReviewWriter extends HTMLElement {
	#signedIn = false;
	#ready = false;
	#open = false;
	#rating = 0;
	#sending = false;
	#sent = false;
	#error = "";

	#onClick = (event: Event) => {
		const target = (event.target as Element | null)?.closest("button");
		if (!target || !this.contains(target)) return;
		const star = target.getAttribute("data-star");
		if (star) {
			this.#rating = Number(star);
			this.#error = "";
			this.render();
		} else if (target.hasAttribute("data-open")) {
			this.#open = true;
			this.render();
			this.querySelector<HTMLButtonElement>("button[data-star]")?.focus();
		}
	};

	#onSubmit = async (event: Event) => {
		const form = (event.target as Element | null)?.closest("form");
		if (!form || !this.contains(form)) return;
		event.preventDefault();
		if (this.#sending) return;
		const fields = new FormData(form);
		const checked = checkReview({ rating: this.#rating, title: fields.get("title"), body: fields.get("body") });
		if (!checked.ok) {
			this.#error = checked.error;
			this.render();
			return;
		}
		this.#sending = true;
		this.#error = "";
		this.render();
		const { status, data } = await postJson<"ok" | "error">(this.getAttribute("data-write-url") ?? "", checked.review);
		this.#sending = false;
		if (data.ok === true) {
			this.#sent = true;
		} else if (status === 401) {
			this.#signedIn = false;
		} else {
			this.#error = typeof data.error === "string" ? data.error : "Couldn't send your review. Try again.";
		}
		this.render();
	};

	/** `{ signedIn }` as a property, in place of the JSON script. */
	set data(value: { signedIn: boolean } | null) {
		if (!value) return;
		this.#signedIn = value.signedIn;
		this.#ready = true;
		if (this.isConnected) this.render();
	}

	connectedCallback() {
		upgradeProperty(this, "data");
		if (!this.#ready) {
			const data = readJson<{ signedIn: boolean }>(this);
			this.#signedIn = data?.signedIn === true;
			this.#ready = true;
		}
		this.addEventListener("click", this.#onClick);
		this.addEventListener("submit", this.#onSubmit);
		this.render();
	}

	disconnectedCallback() {
		this.removeEventListener("click", this.#onClick);
		this.removeEventListener("submit", this.#onSubmit);
	}

	render() {
		const signIn = this.getAttribute("data-sign-in-href") ?? "/my-account";
		if (this.#sent) {
			patch(this, [h("p", { class: "review-writer__sent", role: "status" }, REVIEW_SENT)]);
			return;
		}
		if (!this.#signedIn) {
			patch(this, [h("a", { class: "bd-btn bd-btn--ghost", href: signIn }, "Sign in to write a review")]);
			return;
		}
		if (!this.#open) {
			patch(this, [h("button", { class: "bd-btn", "data-open": true, type: "button" }, "Write a review")]);
			return;
		}
		patch(this, [
			h(
				"form",
				{ class: "review-writer" },
				h(
					"fieldset",
					{ class: "review-writer__stars" },
					h("legend", { class: "bd-label" }, "Your rating"),
					[1, 2, 3, 4, 5].map((star) =>
						h(
							"button",
							{
								"aria-label": `${star} ${star === 1 ? "star" : "stars"}`,
								"aria-pressed": star === this.#rating ? "true" : "false",
								class: `review-writer__star${star <= this.#rating ? " is-on" : ""}`,
								"data-star": star,
								type: "button",
							},
							star <= this.#rating ? "★" : "☆",
						),
					),
				),
				h("label", { class: "bd-label", for: "review-title" }, "Title (optional)"),
				h("input", { class: "bd-input", id: "review-title", maxlength: 200, name: "title" }),
				h("label", { class: "bd-label", for: "review-body" }, "Your review"),
				h("textarea", { class: "bd-textarea", id: "review-body", maxlength: REVIEW_MAX_LENGTH, name: "body", required: true, rows: 5 }),
				h("button", { class: "bd-btn", disabled: this.#sending, type: "submit" }, this.#sending ? "Sending…" : "Send review"),
				this.#error && h("p", { class: "review-writer__error", role: "alert" }, this.#error),
			),
		]);
	}
}

define("bd-review-writer", ReviewWriter);
