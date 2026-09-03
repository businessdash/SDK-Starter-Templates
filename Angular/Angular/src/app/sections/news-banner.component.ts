import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from "@angular/core";
import { BdService } from "../lib/bd.service";

/**
 * Dismissible announcement bar fed by `bundle.banner` (delivered via the
 * home payload). Renders the first enabled message; "Dismiss" hides the
 * bar for the session. No-ops when no banner is configured.
 */
@Component({
	selector: "bd-news-banner",
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (visible() && message(); as m) {
			<div class="news-banner" [class.news-banner--urgent]="m.urgent">
				<span class="news-banner__text">{{ m.text }}</span>
				@if (m.linkUrl && m.buttonText) {
					<a
						class="news-banner__link"
						[href]="m.linkUrl"
						[attr.target]="m.openInNewTab ? '_blank' : null"
						[attr.rel]="m.openInNewTab ? 'noopener' : null"
						>{{ m.buttonText }}</a
					>
				}
				<button class="news-banner__close" type="button" (click)="dismiss()" aria-label="Dismiss">
					×
				</button>
			</div>
		}
	`,
})
export class NewsBannerComponent implements OnInit {
	readonly svc = inject(BdService);
	private readonly dismissed = signal(false);

	readonly message = computed(() => {
		const banner = this.svc.banner();
		if (!banner?.enabled) return null;
		return banner.messages.find((m) => m.enabled) ?? null;
	});
	readonly visible = computed(() => !this.dismissed());

	ngOnInit() {
		void this.svc.loadHome();
	}

	dismiss() {
		this.dismissed.set(true);
	}
}
