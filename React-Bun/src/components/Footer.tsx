import { Subscribe } from "./Subscribe";

export function Footer() {
	return (
		<footer className="app-footer">
			<div className="app-footer__meta">
				<div>
					© {new Date().getFullYear()} Your Business. All rights reserved.
				</div>
				<div>
					Built with{" "}
					<a href="https://github.com/businessdash/platform">
						@businessdash/sdk
					</a>
				</div>
			</div>
			<Subscribe
				className="app-footer__subscribe"
				label="Get updates in your inbox."
				source="footer"
			/>
		</footer>
	);
}
