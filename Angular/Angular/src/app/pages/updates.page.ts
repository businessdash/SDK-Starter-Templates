import { ChangeDetectionStrategy, Component, inject, OnInit } from "@angular/core";
import { RouterLink } from "@angular/router";
import { BdService } from "../lib/bd.service";

/**
 * Standalone /updates route — the full news/updates feed from
 * `bundle.updates`. Shares the BdService signal with the home section.
 */
@Component({
	selector: "bd-updates-page",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [RouterLink],
	template: `
		<section class="section">
			<h1 class="section__title">Updates &amp; news</h1>
			@if (svc.updates().length === 0) {
				<p class="muted">No updates yet — post them in BD and they appear here.</p>
			} @else {
				<ul class="post-list">
					@for (u of svc.updates(); track u.id) {
						<li>
							@if (u.title) {
								<strong>{{ u.title }}</strong>
							}
							@if (u.postedAt) {
								<span class="muted">{{ u.postedAt }}</span>
							}
							<p>{{ u.body }}</p>
							@if (u.link) {
								<a [href]="u.link">Read more</a>
							}
						</li>
					}
				</ul>
			}
			<p class="store-links"><a routerLink="/">Back home</a></p>
		</section>
	`,
})
export class UpdatesPage implements OnInit {
	readonly svc = inject(BdService);
	ngOnInit() {
		void this.svc.loadHome();
	}
}
