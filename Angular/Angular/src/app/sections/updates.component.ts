import { ChangeDetectionStrategy, Component, inject, OnInit } from "@angular/core";
import { BiabService } from "../lib/biab.service";

/**
 * "Updates" feed fed by `bundle.updates` (Google-Business-style posts).
 * Used both as a home section and at the /updates route. Hidden when the
 * org has no updates.
 */
@Component({
	selector: "biab-updates",
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (svc.updates().length > 0) {
			<section class="section" id="updates">
				<h2 class="section__title">Latest updates</h2>
				<ul class="post-list">
					@for (u of svc.updates(); track u.id) {
						<li>
							@if (u.title) {
								<strong>{{ u.title }}</strong>
							}
							<p>{{ u.body }}</p>
							@if (u.link) {
								<a [href]="u.link">Read more</a>
							}
						</li>
					}
				</ul>
			</section>
		}
	`,
})
export class UpdatesComponent implements OnInit {
	readonly svc = inject(BiabService);
	ngOnInit() {
		void this.svc.loadHome();
	}
}
