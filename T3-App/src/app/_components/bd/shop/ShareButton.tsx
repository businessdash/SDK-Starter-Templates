// [bd-file:store]
"use client";
import { useState } from "react";
import { shareLink } from "./shop";

/**
 * Shares this page: the phone's share sheet where there is one, else the
 * link is copied, and a note says so for a moment.
 */
export function ShareButton({ title }: { title: string }) {
	const [note, setNote] = useState("");

	async function share() {
		const url = `${window.location.origin}${window.location.pathname}`;
		const result = await shareLink(url, title);
		const text =
			result === "copied"
				? "Link copied"
				: result === "failed"
					? "Couldn't share"
					: "";
		setNote(text);
		if (text) setTimeout(() => setNote(""), 2500);
	}

	return (
		<>
			<button className="share" onClick={share} type="button">
				<span aria-hidden="true">↗</span> Share
			</button>
			{note && (
				<span className="share__note" role="status">
					{note}
				</span>
			)}
		</>
	);
}
