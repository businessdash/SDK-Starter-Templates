import { ChangeDetectionStrategy, Component, inject, OnInit } from "@angular/core";
import { BdService } from "../lib/bd.service";

@Component({
	selector: "bd-about",
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
	readonly svc = inject(BdService);
	ngOnInit() {
		void this.svc.loadHome();
	}
}
