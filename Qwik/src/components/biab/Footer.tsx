import { component$ } from "@builder.io/qwik";

import { Subscribe } from "./Subscribe";

export const Footer = component$(() => {
	return (
		<footer class="app-footer">
			<div style="max-width: 24rem; flex: 1 1 18rem;">
				<Subscribe
					buttonLabel="Subscribe"
					label="Get updates in your inbox"
					source="footer"
				/>
			</div>
			<div style="display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-end;">
				<div>
					© {new Date().getFullYear()} Your Business. All rights reserved.
				</div>
				<div>
					Built with
					<a href="https://github.com/businessdash/platform">
						@businessdash/sdk
					</a>
				</div>
			</div>
		</footer>
	);
});
