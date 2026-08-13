import { createSignal, For, Show } from "solid-js";

import type { BundleBanner } from "../../lib/biab";

/**
 * Dismissible announcement bar fed by `bundle.banner` (multi-message,
 * schedule-aware on the server). Renders nothing when there's no enabled
 * banner. Dismissal is client-side only (a signal); persisting it across
 * loads is left to the consumer.
 */
export function NewsBanner(props: { banner: BundleBanner | null }) {
	const [dismissed, setDismissed] = createSignal(false);

	return (
		<Show when={props.banner && !dismissed()}>
			<For each={props.banner?.messages ?? []}>
				{(msg) => (
					<div
						style={`background: ${
							msg.urgent ? "var(--danger)" : "var(--accent)"
						}; color: white; padding: 0.6rem 1.25rem; display: flex; align-items: center; justify-content: center; gap: 1rem; font-size: 0.9rem; font-weight: 600;`}
					>
						<span>{msg.text}</span>
						<Show when={msg.linkUrl && msg.buttonText}>
							<a
								href={msg.linkUrl}
								target={msg.openInNewTab ? "_blank" : undefined}
								rel={msg.openInNewTab ? "noreferrer" : undefined}
								style="color: white; border-bottom-color: rgba(255,255,255,0.6); font-weight: 700;"
							>
								{msg.buttonText}
							</a>
						</Show>
						<button
							type="button"
							aria-label="Dismiss"
							onClick={() => setDismissed(true)}
							style="background: transparent; border: none; color: white; font-size: 1.1rem; line-height: 1; padding: 0 0.25rem;"
						>
							×
						</button>
					</div>
				)}
			</For>
		</Show>
	);
}
