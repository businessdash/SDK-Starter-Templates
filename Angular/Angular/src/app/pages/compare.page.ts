// [bd-file:store]
import {
	ChangeDetectionStrategy,
	Component,
	CUSTOM_ELEMENTS_SCHEMA,
	PLATFORM_ID,
	inject,
	signal,
} from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { bdApi } from "../lib/bd-api.client";
import { StoreNavComponent } from "../sections/store-nav.component";
import type { CompareColumn } from "../shop/shop-elements";

/**
 * Up to four products side by side. The products come from ?ids=a,b, so a
 * comparison can be shared; opened without ids, `<bd-compare>` moves this
 * browser's picks into the URL.
 */
@Component({
	selector: "bd-compare-page",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [StoreNavComponent],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	template: `
		<bd-store-nav />
		<div class="bd-page">
			<div class="bd-section__lead">
				<span class="bd-section__eyebrow">Shop</span>
				<h1 class="bd-section__title">Compare</h1>
				<p class="bd-section__sub">Up to four products side by side.</p>
			</div>
			@if (!data()) {
				<p class="bd-loading">Loading…</p>
			}
			<bd-compare data-store-href="/store" [data]="data()" />
		</div>
	`,
})
export class ComparePage {
	private readonly route = inject(ActivatedRoute);
	readonly data = signal<{ ids: string[]; columns: CompareColumn[] } | null>(null);

	constructor() {
		const browser = isPlatformBrowser(inject(PLATFORM_ID));
		this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
			if (!browser) return;
			const ids = (params.get("ids") ?? "")
				.split(",")
				.map((part) => part.trim())
				.filter(Boolean)
				.slice(0, 4);
			void bdApi.compare(ids).then((columns) => this.data.set({ ids, columns }));
		});
	}
}
