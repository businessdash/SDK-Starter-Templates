import { useEffect, useState } from "react";

import { bd } from "../lib/bd";
import { Subscribe } from "./Subscribe";

export function About() {
	const [body, setBody] = useState<string | null>(null);

	useEffect(() => {
		bd.marketing
			.getPageBundle({ pageKey: "home" })
			.then((bundle) => {
				const raw = (bundle as { sections?: Record<string, unknown> })?.sections
					?.about;
				if (
					raw &&
					typeof raw === "object" &&
					"ok" in raw &&
					(raw as { ok: boolean }).ok
				) {
					const data = (raw as unknown as { data: Record<string, unknown> })
						.data;
					if (typeof data?.body === "string") setBody(data.body);
				}
			})
			.catch(() => undefined);
	}, []);

	return (
		<section className="bd-section bd-section--narrow" id="about">
			<div className="bd-section__lead">
				<span className="bd-section__eyebrow">About</span>
				<h2 className="bd-section__title">Built around how you actually work.</h2>
			</div>
			<p style={{ color: "var(--text)", fontSize: "1.05rem", textAlign: "center" }}>
				{body ??
					"We're a small team that takes pride in being available. Real schedule, real reviews, real follow-up — no automated runaround. Book a slot below or send us a note and we'll get right back to you."}
			</p>
			<Subscribe
				className="about__subscribe"
				label="Stay in the loop — get our updates by email."
				source="about"
			/>
		</section>
	);
}
