import { Subscribe } from "./Subscribe";

export function About({ body }: { body: string }) {
	return (
		<section className="biab-section biab-section--narrow" id="about">
			<div className="biab-section__lead">
				<span className="biab-section__eyebrow">About</span>
				<h2 className="biab-section__title">
					Built around how you actually work.
				</h2>
			</div>
			<p
				style={{ color: "var(--text)", fontSize: "1.05rem", textAlign: "center" }}
			>
				{body}
			</p>
			<Subscribe
				className="about__subscribe"
				idPrefix="about-subscribe"
				label="Stay in the loop"
				source="about"
			/>
		</section>
	);
}
