import { ChangeDetectionStrategy, Component, inject, OnInit } from "@angular/core";
import { BdService } from "../lib/bd.service";

@Component({
	selector: "bd-services",
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
	readonly svc = inject(BdService);
	ngOnInit() {
		void this.svc.loadHome();
	}
}
