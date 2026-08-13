import { component$ } from "@builder.io/qwik";

import { Subscribe } from "./Subscribe";

export const About = component$<{ body: string }>(({ body }) => {
	return (
		<section class="biab-section biab-section--narrow" id="about">
			<div class="biab-section__lead">
				<span class="biab-section__eyebrow">About</span>
				<h2 class="biab-section__title">
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
