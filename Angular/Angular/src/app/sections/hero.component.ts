import { ChangeDetectionStrategy, Component, inject, OnInit } from "@angular/core";
import { BiabService } from "../lib/biab.service";

@Component({
	selector: "biab-hero",
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<section class="hero" id="hero">
			<span class="biab-badge">Open · Mon–Sat</span>
			<h1 class="hero__title">{{ svc.hero().title }}</h1>
			<p class="hero__sub">{{ svc.hero().tagline }}</p>
			<a class="biab-btn" [href]="svc.hero().ctaHref">{{ svc.hero().ctaLabel }}</a>
		</section>
	`,
})
export class HeroComponent implements OnInit {
	readonly svc = inject(BiabService);
	ngOnInit() {
		void this.svc.loadHome();
	}
}
