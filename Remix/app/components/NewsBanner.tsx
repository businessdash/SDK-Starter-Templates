import { useState } from "react";

export type BannerMessage = {
	id: string;
	text: string;
	linkUrl: string;
	buttonText: string;
	openInNewTab: boolean;
	urgent?: boolean;
};

/**
 * Dismissible news banner. Renders the bundle's first active banner message
 * (`bundle.banner.messages`). Dismissal is client-side only (this turn) — a
 * production app would persist it per `appearance` rule (once / until_dismiss
 * / every). Returns null when there's nothing to show.
 */
export function NewsBanner({ message }: { message: BannerMessage | null }) {
	const [dismissed, setDismissed] = useState(false);
	if (!message || dismissed) return null;
	return (
		<div className={`news-banner${message.urgent ? " news-banner--urgent" : ""}`}>
			<span>{message.text}</span>
			{message.linkUrl && message.buttonText ? (
				<a
					href={message.linkUrl}
					{...(message.openInNewTab
						? { target: "_blank", rel: "noreferrer" }
						: {})}
				>
					{message.buttonText}
				</a>
			) : null}
			<button
				className="news-banner__close"
				aria-label="Dismiss"
				onClick={() => setDismissed(true)}
			>
				×
			</button>
		</div>
	);
}
