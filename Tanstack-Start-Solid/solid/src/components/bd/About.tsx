import { Subscribe } from "./Subscribe";

export function About(props: { body: string }) {
	return (
		<section class="bd-section bd-section--narrow" id="about">
			<div class="bd-section__lead">
				<span class="bd-section__eyebrow">About</span>
				<h2 class="bd-section__title">Built around how you actually work.</h2>
			</div>
			<p style="color: var(--text); font-size: 1.05rem; text-align: center;">
				{props.body}
			</p>
			<div style="margin-top: 2rem; display: flex; justify-content: center;">
				<Subscribe
					buttonLabel="Subscribe"
					label="Stay in the loop"
					source="about"
				/>
			</div>
		</section>
	);
}
