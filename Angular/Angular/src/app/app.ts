import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";

import { NewsBannerComponent } from "./sections/news-banner.component";
import { HeaderComponent } from "./sections/header.component";
import { FooterComponent } from "./sections/footer.component";
import { SdkSetupBannerComponent } from "./sections/sdk-setup-banner.component";

/**
 * App shell: dismissible news banner + header nav, the routed view, and the
 * footer, plus the BD setup banner shown until the SDK is connected. Page
 * content is rendered through the router (see app.routes.ts).
 */
@Component({
	selector: "app-root",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		RouterOutlet,
		NewsBannerComponent,
		HeaderComponent,
		FooterComponent,
		SdkSetupBannerComponent,
	],
	templateUrl: "./app.html",
	styleUrl: "./app.scss",
})
export class App {}
