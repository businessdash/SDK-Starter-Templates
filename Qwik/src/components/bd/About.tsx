import { component$ } from "@builder.io/qwik";

import { Subscribe } from "./Subscribe";

export const About = component$<{ body: string }>(({ body }) => {
	return (
		<section class="bd-section bd-section--narrow" id="about">
			<div class="bd-section__lead">
				<span class="bd-section__eyebrow">About</span>
				<h2 class="bd-section__title">
					Built around how you actually work.
				</h2>
			</div>
			<p style="color: var(--text); font-size: 1.05rem; text-align: center;">
				{body}
			</p>
			<div style="max-width: 28rem; margin: 2rem auto 0;">
				<Subscribe
					buttonLabel="Subscribe"
					label="Like what you see? Stay in the loop."
					source="about"
				/>
			</div>
		</section>
	);
});
