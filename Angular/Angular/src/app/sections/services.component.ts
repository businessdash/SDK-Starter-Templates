import { ChangeDetectionStrategy, Component, inject, OnInit } from "@angular/core";
import { BiabService } from "../lib/biab.service";

@Component({
	selector: "biab-services",
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<section class="section" id="services">
			<h2 class="section__title">Services</h2>
			<div class="grid">
				@for (s of svc.services(); track s.id) {
					<article class="card">
						<h3>{{ s.name }}</h3>
						<p>{{ s.description }}</p>
						<span class="price">{{ s.priceLabel }}</span>
					</article>
				}
			</div>
		</section>
	`,
})
export class ServicesComponent implements OnInit {
	readonly svc = inject(BiabService);
	ngOnInit() {
		void this.svc.loadHome();
	}
}
