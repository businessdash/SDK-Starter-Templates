/** News banner — the dismissible `bundle.banner` message (untyped passthrough). */
import { useEffect, useState } from "react";
import { bd } from "../lib/bd";
import type { Loose } from "../lib/bd";

type Msg = { id: string; text: string; link: string | null; linkText: string | null };

export function Banner() {
	const [msg, setMsg] = useState<Msg | null>(null);
	const [dismissed, setDismissed] = useState(false);
	useEffect(() => {
		let alive = true;
		bd.content
			.extras()
			.then((x) => {
				if (alive) setMsg(pick(x.banner));
			})
			.catch(() => {});
		return () => {
			alive = false;
		};
	}, []);
	if (!msg || dismissed) return null;
	return (
		<div className="newsbanner" role="region" aria-label="Announcement">
			<span className="newsbanner__text">{msg.text}</span>
			{msg.link ? (
				<a className="newsbanner__link" href={msg.link}>
					{msg.linkText || "Learn more"}
				</a>
			) : null}
			<button className="newsbanner__close" type="button" aria-label="Dismiss" onClick={() => setDismissed(true)}>
				×
			</button>
		</div>
	);
}

function pick(banner: Loose | null): Msg | null {
	if (!banner || banner.enabled === false) return null;
	const list: Loose[] = Array.isArray(banner.messages) ? banner.messages : banner.message || banner.text ? [banner] : [];
	const now = Date.now();
	for (const m of list) {
		const from = m.displayFromUtc ? Date.parse(m.displayFromUtc) : null;
		const until = m.displayUntilUtc ? Date.parse(m.displayUntilUtc) : null;
		if (from && from > now) continue;
		if (until && until < now) continue;
		const text = m.text ?? m.message;
		if (!text) continue;
		return { id: String(m.id ?? text).slice(0, 48), text, link: m.link ?? null, linkText: m.linkText ?? m.buttonText ?? null };
	}
	return null;
}
