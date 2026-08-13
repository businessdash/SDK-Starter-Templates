import { component$, useSignal } from "@builder.io/qwik";

import type { BundleBannerMessage } from "../../lib/biab-content";

/**
 * Dismissible announcement bar fed by `bundle.banner.messages`. Server-rendered
 * (so the first message is in the SSR HTML, no flash) with a client-side
 * dismiss. Shows the first active message; the banner data is resolved
 * server-side in the home loader.
 */
export const Banner = component$<{ messages: BundleBannerMessage[] }>(
	({ messages }) => {
		const dismissed = useSignal(false);
		const message = messages[0];
		if (!message || dismissed.value) return null;

		return (
			<div
				role="status"
				style={`display: flex; align-items: center; justify-content: center; gap: 1rem; padding: 0.6rem 1rem; font-size: 0.9rem; background: ${message.urgent ? "var(--danger-bg)" : "var(--accent-bg)"}; color: ${message.urgent ? "var(--danger)" : "var(--accent)"}; border-bottom: 1px solid var(--border);`}
			>
				<span>{message.text}</span>
				{message.linkUrl ? (
					<a
						href={message.linkUrl}
						target={message.openInNewTab ? "_blank" : undefined}
						rel={message.openInNewTab ? "noopener noreferrer" : undefined}
						style="font-weight: 600;"
					>
						{message.buttonText || "Learn more"}
					</a>
				) : null}
				<button
					aria-label="Dismiss"
					onClick$={() => {
						dismissed.value = true;
					}}
					style="background: transparent; border: none; color: inherit; font-size: 1.1rem; line-height: 1; padding: 0 0.25rem;"
					type="button"
				>
					×
				</button>
			</div>
		);
	},
);
