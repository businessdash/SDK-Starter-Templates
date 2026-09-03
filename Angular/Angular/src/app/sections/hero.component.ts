import { ChangeDetectionStrategy, Component, inject, OnInit } from "@angular/core";
import { BdService } from "../lib/bd.service";

@Component({
	selector: "bd-hero",
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<section class="hero" id="hero">
			<span class="bd-badge">Open · Mon–Sat</span>
			<h1 class="hero__title">{{ svc.hero().title }}</h1>
			<p class="hero__sub">{{ svc.hero().tagline }}</p>
			<a class="bd-btn" [href]="svc.hero().ctaHref">{{ svc.hero().ctaLabel }}</a>
		</section>
	`,
})
export class HeroComponent implements OnInit {
	readonly svc = inject(BdService);
	ngOnInit() {
		void this.svc.loadHome();
	}
}
