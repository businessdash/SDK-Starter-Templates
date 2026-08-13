import { ChangeDetectionStrategy, Component, inject, OnInit } from "@angular/core";
import { BiabService } from "../lib/biab.service";

@Component({
	selector: "biab-about",
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<section class="section" id="about">
			<h2 class="section__title">About</h2>
			@for (block of svc.about(); track block.heading) {
				<article class="card">
					<h3>{{ block.heading }}</h3>
					<p>{{ block.body }}</p>
				</article>
			}
		</section>
	`,
})
export class AboutComponent implements OnInit {
	readonly svc = inject(BiabService);
	ngOnInit() {
		void this.svc.loadHome();
	}
}
