import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterLink, RouterLinkActive } from "@angular/router";

/**
 * Site header. The brand + "Home" use routerLink so cross-route navigation
 * works; the commerce/portal links route to the new BD surfaces.
 * Sign-in is a plain href — the auth handler 302s through WorkOS.
 */
@Component({
	selector: "bd-header",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [RouterLink, RouterLinkActive],
	template: `
		<header class="header">
			<a class="brand" routerLink="/">Your Business</a>
			<nav>
				<a routerLink="/" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: true }">Home</a>
				<!-- [bd:store] -->
				<a routerLink="/store" routerLinkActive="is-active">Store</a>
				<!-- [/bd:store] -->
				<!-- The store bar links the plans when there is a store. -->
				<!-- [bd:subscriptions] -->
				<!-- [bd:!store] -->
				<a routerLink="/subscriptions" routerLinkActive="is-active">Plans</a>
				<!-- [/bd:!store] -->
				<!-- [/bd:subscriptions] -->
				<!-- [bd:blog] -->
				<a routerLink="/blog" routerLinkActive="is-active">Blog</a>
				<!-- [/bd:blog] -->
				<!-- [bd:booking] -->
				<a routerLink="/booking" routerLinkActive="is-active">Book</a>
				<!-- [/bd:booking] -->
				<a routerLink="/reviews" routerLinkActive="is-active">Reviews</a>
				<a routerLink="/updates" routerLinkActive="is-active">Updates</a>
				<a routerLink="/todos" routerLinkActive="is-active">Todos</a>
				<a routerLink="/my-account" routerLinkActive="is-active">Account</a>
			</nav>
		</header>
	`,
})
export class HeaderComponent {}
