// [bd-file:blog]
/**
 * A post's like button and comments as custom elements, for pages a server
 * renders without a UI framework. They draw the same markup as the React
 * BlogPost (and so take the same bd-blog.css):
 *
 *   <bd-post-like data-like-url="/api/…" data-sign-in-href="/my-account?next=…">
 *     <script type="application/json">{"likes":{"liked":false,"likesCount":4},"signedIn":true}</script>
 *   </bd-post-like>
 *   <bd-post-comments data-comment-url="/api/…" data-sign-in-href="…">
 *     <script type="application/json">{"comments":[…],"signedIn":true}</script>
 *   </bd-post-comments>
 *
 * Liking POSTs `{}` and gets `{ liked, likesCount }` or `{ error }`;
 * commenting POSTs `{ content }` and gets `{ ok, approved, comments }` or
 * `{ ok: false, error }`. Signed out, both lead to sign-in and back.
 */
import type {
	BlogLikeResponse,
	BlogPublicComment,
} from "@businessdash/sdk/contracts";

import {
	define,
	h,
	patch,
	postJson,
	readJson,
	upgradeProperty,
} from "./bd-dom";
import { formatPostDate } from "./blog";

// For pages that list posts in the browser.
export { formatPostDate, readingMinutes } from "./blog";

class PostLike extends HTMLElement {
	#likes: BlogLikeResponse = { liked: false, likesCount: 0 };
	#signedIn = false;
	#error = "";
	#busy = false;
	#ready = false;
	#onClick = async (event: Event) => {
		if (
			!(event.target as Element | null)?.closest("[data-act=like]") ||
			this.#busy
		)
			return;
		this.#busy = true;
		this.#error = "";
		const { data } = await postJson<"liked" | "likesCount" | "error">(
			this.getAttribute("data-like-url") ?? "",
			{},
		);
		this.#busy = false;
		if (typeof data.likesCount === "number") {
			this.#likes = { liked: data.liked === true, likesCount: data.likesCount };
		} else {
			this.#error =
				typeof data.error === "string"
					? data.error
					: "Couldn't save your like. Try again.";
		}
		this.render();
	};

	/** The likes as a property (Angular: `[data]="…"`), in place of the JSON script. */
	set data(value: { likes: BlogLikeResponse; signedIn: boolean } | null) {
		if (!value) return;
		this.#likes = value.likes;
		this.#signedIn = value.signedIn;
		this.#ready = true;
		if (this.isConnected) this.render();
	}

	connectedCallback() {
		upgradeProperty(this, "data");
		if (!this.#ready) {
			const data = readJson<{ likes: BlogLikeResponse; signedIn: boolean }>(
				this,
			);
			if (data) {
				this.#likes = data.likes;
				this.#signedIn = data.signedIn;
				this.#ready = true;
			}
		}
		this.addEventListener("click", this.#onClick);
		// Without data yet, the property brings it.
		if (this.#ready) this.render();
	}

	disconnectedCallback() {
		this.removeEventListener("click", this.#onClick);
	}

	render() {
		const likes = this.#likes;
		const signIn = this.getAttribute("data-sign-in-href") ?? "/my-account";
		patch(this, [
			h(
				"div",
				{ class: "post__like" },
				this.#signedIn
					? h(
							"button",
							{
								"aria-pressed": String(likes.liked),
								class: `like${likes.liked ? " like--on" : ""}`,
								"data-act": "like",
								type: "button",
							},
							h("span", { "aria-hidden": "true" }, likes.liked ? "♥" : "♡"),
							likes.liked ? "Liked" : "Like",
						)
					: h(
							"a",
							{ class: "like", href: signIn },
							h("span", { "aria-hidden": "true" }, "♡"),
							" Sign in to like",
						),
				h(
					"span",
					{ class: "post__likes" },
					`${likes.likesCount} ${likes.likesCount === 1 ? "like" : "likes"}`,
				),
				this.#error &&
					h("span", { class: "post__error", role: "alert" }, this.#error),
			),
		]);
	}
}

class PostComments extends HTMLElement {
	#comments: BlogPublicComment[] = [];
	#signedIn = false;
	#posting = false;
	#note: { kind: "ok" | "error"; text: string } | null = null;
	#ready = false;
	#onSubmit = async (event: Event) => {
		const form = (event.target as Element | null)?.closest("form");
		if (!form || !this.contains(form)) return;
		event.preventDefault();
		const box = form.querySelector("textarea");
		const content = box?.value.trim() ?? "";
		if (!content || this.#posting) return;
		this.#posting = true;
		this.#note = null;
		this.render();
		const { data } = await postJson<"ok" | "comments" | "approved" | "error">(
			this.getAttribute("data-comment-url") ?? "",
			{ content },
		);
		this.#posting = false;
		if (data.ok === true && Array.isArray(data.comments)) {
			if (box) box.value = "";
			this.#comments = data.comments as BlogPublicComment[];
			this.#note = {
				kind: "ok",
				text:
					data.approved === true
						? "Comment posted."
						: "Thanks! Your comment shows once it's approved.",
			};
		} else {
			this.#note = {
				kind: "error",
				text:
					typeof data.error === "string"
						? data.error
						: "Couldn't post your comment. Try again.",
			};
		}
		this.render();
	};

	/** The comments as a property (Angular: `[data]="…"`), in place of the JSON script. */
	set data(value: { comments: BlogPublicComment[]; signedIn: boolean } | null) {
		if (!value) return;
		this.#comments = value.comments;
		this.#signedIn = value.signedIn;
		this.#ready = true;
		if (this.isConnected) this.render();
	}

	connectedCallback() {
		upgradeProperty(this, "data");
		if (!this.#ready) {
			const data = readJson<{
				comments: BlogPublicComment[];
				signedIn: boolean;
			}>(this);
			if (data) {
				this.#comments = data.comments;
				this.#signedIn = data.signedIn;
				this.#ready = true;
			}
		}
		this.addEventListener("submit", this.#onSubmit);
		// Without data yet, the property brings it.
		if (this.#ready) this.render();
	}

	disconnectedCallback() {
		this.removeEventListener("submit", this.#onSubmit);
	}

	render() {
		const comments = this.#comments;
		const signIn = this.getAttribute("data-sign-in-href") ?? "/my-account";
		const note = this.#note;
		patch(this, [
			h(
				"section",
				{ "aria-labelledby": "comments-title", class: "comments" },
				h(
					"h2",
					{ id: "comments-title" },
					`${comments.length} ${comments.length === 1 ? "comment" : "comments"}`,
				),
				this.#signedIn
					? h(
							"form",
							{ class: "comments__form" },
							h(
								"label",
								{ class: "bd-label", for: "comment" },
								"Add a comment",
							),
							h("textarea", {
								class: "bd-textarea",
								id: "comment",
								maxlength: 5000,
								name: "content",
								required: true,
								rows: 4,
							}),
							h(
								"button",
								{ class: "bd-btn", disabled: this.#posting, type: "submit" },
								this.#posting ? "Posting…" : "Post comment",
							),
							note &&
								h(
									"p",
									{
										class: note.kind === "ok" ? "comments__ok" : "post__error",
										role: note.kind === "ok" ? "status" : "alert",
									},
									note.text,
								),
						)
					: h(
							"p",
							{ class: "comments__signin" },
							h(
								"a",
								{ class: "bd-btn bd-btn--ghost", href: signIn },
								"Sign in to comment",
							),
						),
				comments.length > 0 &&
					h(
						"ol",
						{ class: "comments__list" },
						comments.map((c) =>
							h(
								"li",
								{
									class: `comment${c.parentId !== null ? " comment--reply" : ""}`,
								},
								h(
									"p",
									{ class: "comment__head" },
									h("strong", null, c.authorName ?? "Reader"),
									h("span", null, formatPostDate(c.createdAt)),
								),
								h("p", { class: "comment__body" }, c.content),
							),
						),
					),
			),
		]);
	}
}

define("bd-post-like", PostLike);
define("bd-post-comments", PostComments);
