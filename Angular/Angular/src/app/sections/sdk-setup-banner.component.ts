import {
	afterNextRender,
	ChangeDetectionStrategy,
	Component,
	signal,
} from "@angular/core";

import { environment } from "../../environments/environment";

/**
 * Dismissible "not connected yet" banner. The template renders all its content
 * with local fallbacks when BD env is missing (so it runs unconfigured) —
 * this just tells you how to connect it. It disappears automatically once the
 * browser-safe BD config (site id + publishable token) is set in
 * `src/environments/environment.ts`, and can be dismissed for this browser in
 * the meantime.
 *
 * The config check + `localStorage` read run in `afterNextRender` (browser
 * only, after hydration), so the SSR render and client hydration stay in sync.
 */
const DISMISS_KEY = "bd-sdk-setup-banner-dismissed";

@Component({
	selector: "bd-sdk-setup-banner",
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (visible()) {
			<div class="bd-setup-banner" role="status">
				<span class="bd-setup-banner__text">
					<strong>Not connected to BD yet.</strong>
					Add your <code>.env</code> (server) and
					<code>environment.ts</code> (browser) to render live content — grab
					every value from the guided wizard.
				</span>
				<a
					class="bd-setup-banner__cta"
					[href]="wizardUrl"
					target="_blank"
					rel="noopener"
					>Open setup wizard ↗</a
				>
				<button
					class="bd-setup-banner__close"
					type="button"
					(click)="dismiss()"
					aria-label="Dismiss"
				>
					✕
				</button>
			</div>
		}
	`,
	styles: [
		`
			.bd-setup-banner {
				position: fixed;
				left: 0;
				right: 0;
				bottom: 0;
				z-index: 9999;
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 0.75rem;
				padding: 0.75rem 1rem;
				background: rgba(15, 23, 42, 0.96);
				color: #fff;
				border-top: 1px solid rgba(45, 212, 191, 0.35);
				backdrop-filter: blur(8px);
				font-size: 0.875rem;
			}
			.bd-setup-banner__text {
				flex: 1 1 260px;
				min-width: 0;
			}
			.bd-setup-banner__text strong {
				color: rgb(94, 234, 212);
			}
			.bd-setup-banner__cta {
				flex-shrink: 0;
				border-radius: 0.5rem;
				border: 1px solid rgba(45, 212, 191, 0.5);
				background: rgba(45, 212, 191, 0.12);
				padding: 0.4rem 0.8rem;
				color: rgb(153, 246, 228);
				font-weight: 600;
				text-decoration: none;
			}
			.bd-setup-banner__close {
				flex-shrink: 0;
				border: none;
				background: transparent;
				color: rgba(255, 255, 255, 0.6);
				cursor: pointer;
				font-size: 1.1rem;
				line-height: 1;
				padding: 0.25rem;
			}
		`,
	],
})
export class SdkSetupBannerComponent {
	protected readonly visible = signal(false);
	protected readonly wizardUrl = `${
		environment.bdBaseUrl || "https://www.biab.app"
	}/login?returnTo=/dashboard/settings/web-content`;

	constructor() {
		afterNextRender(() => {
			const configured = Boolean(environment.bdSiteId && environment.bdPk);
			if (configured) return; // connected — nothing to show
			if (localStorage.getItem(DISMISS_KEY) === "1") return;
			this.visible.set(true);
		});
	}

	protected dismiss(): void {
		try {
			localStorage.setItem(DISMISS_KEY, "1");
		} catch {
			// storage disabled / quota — best-effort.
		}
		this.visible.set(false);
	}
}
