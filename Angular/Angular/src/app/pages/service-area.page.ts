import { ChangeDetectionStrategy, Component, DOCUMENT, OnInit, inject, signal } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { Title, Meta } from "@angular/platform-browser";
import { bdApi, type ParallelPageRender } from "../lib/bd-api.client";

/**
 * Programmatic SEO page: /services/:service/:area. Calls the server, which
 * runs `client.parallelPages.render("service-area", { service, area })`.
 * BD resolves brand/service/area tokens server-side, so `meta.title`,
 * `meta.description`, `meta.canonical` and the rendered body come back ready.
 * We set the document title + meta tags from the render result.
 */
@Component({
	selector: "bd-service-area-page",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [RouterLink],
	template: `
		<section class="section">
			@if (state() === "loading") {
				<p class="muted">Loading…</p>
			} @else if (state() === "missing") {
				<h1 class="section__title">Page not found</h1>
				<p class="muted">This service/area combination isn't available. <a routerLink="/services">See all areas</a>.</p>
			} @else if (page(); as p) {
				<h1 class="section__title">{{ p.meta.title }}</h1>
				<p class="muted">{{ p.meta.description }}</p>
				@if (bodyText(p); as text) {
					<div class="parallel-body">{{ text }}</div>
				}
				<p class="store-links"><a routerLink="/services">All service areas</a></p>
			}
		</section>
	`,
})
export class ServiceAreaPage implements OnInit {
	private readonly route = inject(ActivatedRoute);
	private readonly title = inject(Title);
	private readonly meta = inject(Meta);
	private readonly doc = inject(DOCUMENT);
	readonly page = signal<ParallelPageRender | null>(null);
	readonly state = signal<"loading" | "ready" | "missing">("loading");

	async ngOnInit() {
		const service = this.route.snapshot.paramMap.get("service");
		const area = this.route.snapshot.paramMap.get("area");
		if (!service || !area) {
			this.state.set("missing");
			return;
		}
		const res = await bdApi.servicePage(service, area);
		if (!res) {
			this.state.set("missing");
			return;
		}
		this.page.set(res);
		this.state.set("ready");
		if (res.meta.title) this.title.setTitle(res.meta.title);
		if (res.meta.description) {
			this.meta.updateTag({ name: "description", content: res.meta.description });
		}
		if (res.meta.canonical) {
			this.setCanonical(res.meta.canonical);
		}
	}

	private setCanonical(href: string): void {
		const head = this.doc.head;
		let link = head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
		if (!link) {
			link = this.doc.createElement("link");
			link.setAttribute("rel", "canonical");
			head.appendChild(link);
		}
		link.setAttribute("href", href);
	}

	bodyText(p: ParallelPageRender): string | null {
		if (p.body == null) return null;
		if (typeof p.body === "string") return p.body;
		try {
			return JSON.stringify(p.body, null, 2);
		} catch {
			return null;
		}
	}
}
