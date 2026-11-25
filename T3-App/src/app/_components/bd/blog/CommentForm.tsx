// [bd-file:blog]
"use client";
import type { BlogPublicComment } from "@businessdash/sdk/contracts";
import { type FormEvent, useState } from "react";
import type { CommentResult } from "./BlogPost";

/**
 * Write a comment. `onComment` is the page's call to its server; after a
 * comment goes through, `onPosted` gets the post's comments as they now are.
 */
export function CommentForm({
	onComment,
	onPosted,
}: {
	onComment: (content: string) => Promise<CommentResult>;
	onPosted: (comments: BlogPublicComment[]) => void;
}) {
	const [draft, setDraft] = useState("");
	const [posting, setPosting] = useState(false);
	const [note, setNote] = useState<{
		kind: "ok" | "error";
		text: string;
	} | null>(null);

	async function submit(event: FormEvent) {
		event.preventDefault();
		const content = draft.trim();
		if (!content) return;
		setPosting(true);
		setNote(null);
		const res = await onComment(content);
		setPosting(false);
		if (!res.ok) {
			setNote({ kind: "error", text: res.error });
			return;
		}
		setDraft("");
		onPosted(res.comments);
		setNote({
			kind: "ok",
			text: res.approved
				? "Comment posted."
				: "Thanks! Your comment shows once it's approved.",
		});
	}

	return (
		<form className="comments__form" onSubmit={submit}>
			<label className="bd-label" htmlFor="comment">
				Add a comment
			</label>
			<textarea
				className="bd-textarea"
				id="comment"
				maxLength={5000}
				name="content"
				onChange={(e) => setDraft(e.target.value)}
				required
				rows={4}
				value={draft}
			/>
			<button className="bd-btn" disabled={posting} type="submit">
				{posting ? "Posting…" : "Post comment"}
			</button>
			{note && (
				<p
					className={note.kind === "ok" ? "comments__ok" : "post__error"}
					role={note.kind === "ok" ? "status" : "alert"}
				>
					{note.text}
				</p>
			)}
		</form>
	);
}
