"use client";

import { useEffect, useState } from "react";

import type { BundleBanner } from "@/server/lib/bd";

/**
 * Dismissible news banner fed by `bundle.banner`. Cycles through the org's
 * active messages (one strip, first message shown; the rest accessible if you
 * add navigation later). Dismissal is remembered for the session via
 * sessionStorage so a refresh doesn't re-show it.
 */
export function NewsBanner({ banner }: { banner: BundleBanner | null }) {
	const [dismissed, setDismissed] = useState(true);

	const first = banner?.messages[0] ?? null;
	const key = first ? `bd-banner-dismissed:${first.id}` : null;

	useEffect(() => {
		if (!key) return;
		setDismissed(sessionStorage.getItem(key) === "1");
	}, [key]);

	if (!first || dismissed) return null;

	function dismiss() {
		if (key) sessionStorage.setItem(key, "1");
		setDismissed(true);
	}

	return (
		<div
			className={`news-banner${first.urgent ? "news-banner--urgent" : ""}`}
			role="status"
		>
			<span className="news-banner__text">{first.text}</span>
			{first.linkUrl ? (
				<a
					className="news-banner__cta"
					href={first.linkUrl}
					rel={first.openInNewTab ? "noreferrer" : undefined}
					target={first.openInNewTab ? "_blank" : undefined}
				>
					{first.buttonText || "Learn more"}
				</a>
			) : null}
			<button
				aria-label="Dismiss"
				className="news-banner__close"
				onClick={dismiss}
				type="button"
			>
				×
			</button>
		</div>
	);
}
