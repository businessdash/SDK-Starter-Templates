import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
	selector: "bd-footer",
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<footer class="footer">
			<p>© {{ year }} Your Business — built on BD.</p>
		</footer>
	`,
})
export class FooterComponent {
	readonly year = new Date().getFullYear();
}
