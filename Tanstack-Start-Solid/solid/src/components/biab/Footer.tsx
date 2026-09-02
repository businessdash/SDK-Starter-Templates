import { Subscribe } from "./Subscribe";

export function BiabFooter() {
	return (
		<footer class="app-footer">
			<div>
				© {new Date().getFullYear()} Your Business. All rights reserved.
			</div>
			<Subscribe
				buttonLabel="Sign up"
				label="Newsletter"
				placeholder="you@example.com"
				source="footer"
			/>
			<div>
				Built with
				<a href="https://github.com/businessdash/platform">
					@businessdash/sdk
				</a>
			</div>
		</footer>
	);
}
