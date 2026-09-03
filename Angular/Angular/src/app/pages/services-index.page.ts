import { ChangeDetectionStrategy, Component, OnInit, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { bdApi } from "../lib/bd-api.client";

type Variant = { service?: string; area?: string };

/**
 * Index of the programmatic /services/:service/:area pages. Lists the
 * (service × area) variants returned by `parallelPages.listVariants(...)`
 * via the server, linking each to its rendered page.
 */
@Component({
	selector: "bd-services-index-page",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [RouterLink],
	template: `
		<section class="section">
			<h1 class="section__title">Service areas</h1>
			@if (variants().length === 0) {
				<p class="muted">
					No programmatic pages yet — define services + service areas in BD and publish the
					schema (<code>pnpm sync-schema</code>) to generate them.
				</p>
			} @else {
				<ul class="post-list">
					@for (v of variants(); track trackVariant(v)) {
						<li>
							<a [routerLink]="['/services', v.service, v.area]">
								{{ v.service }} in {{ v.area }}
							</a>
						</li>
					}
				</ul>
			}
		</section>
	`,
})
export class ServicesIndexPage implements OnInit {
	readonly variants = signal<Variant[]>([]);

	async ngOnInit() {
		const res = await bdApi.serviceVariants();
		this.variants.set((res?.variants ?? []) as Variant[]);
	}

	trackVariant(v: Variant): string {
		return `${v.service ?? ""}/${v.area ?? ""}`;
	}
}
