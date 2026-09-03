import { ChangeDetectionStrategy, Component } from "@angular/core";

import { HeroComponent } from "../sections/hero.component";
import { AboutComponent } from "../sections/about.component";
import { ServicesComponent } from "../sections/services.component";
import { ReviewsSummaryComponent } from "../sections/reviews-summary.component";
import { UpdatesComponent } from "../sections/updates.component";
import { BlogComponent } from "../sections/blog.component";
import { ContactFormComponent } from "../sections/contact-form.component";

/**
 * Home route — the original single-page marketing layout, now mounted at `/`
 * so the new store / cart / account / reviews routes can live alongside it.
 */
@Component({
	selector: "bd-home-page",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		HeroComponent,
		AboutComponent,
		ServicesComponent,
		ReviewsSummaryComponent,
		UpdatesComponent,
		BlogComponent,
		ContactFormComponent,
	],
	template: `
		<bd-hero />
		<bd-about />
		<bd-services />
		<bd-reviews-summary />
		<bd-updates />
		<bd-blog />
		<bd-contact-form />
	`,
})
export class HomePage {}
