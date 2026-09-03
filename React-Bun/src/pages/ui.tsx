/** Shared bits for the feature pages: a fetch hook, an error box, a heading. */
import { useEffect, useState } from "react";

export function useApi<T>(fn: () => Promise<T>, deps: unknown[] = []) {
	const [data, setData] = useState<T | null>(null);
	const [error, setError] = useState<unknown>(null);
	const [loading, setLoading] = useState(true);
	useEffect(() => {
		let alive = true;
		setLoading(true);
		setError(null);
		fn()
			.then((d) => {
				if (alive) {
					setData(d);
					setLoading(false);
				}
			})
			.catch((e) => {
				if (alive) {
					setError(e);
					setLoading(false);
				}
			});
		return () => {
			alive = false;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, deps);
	return { data, error, loading };
}

export function ErrorBox({ error }: { error: unknown }) {
	const msg = String((error as { message?: string })?.message ?? error ?? "");
	const unavailable = /unavailable|\b503\b/.test(msg);
	return (
		<div className="page__error">
			{unavailable
				? "This site is temporarily unavailable. Please check back soon."
				: "Couldn't load this — is BD configured on the server? (see .env.example)"}
		</div>
	);
}

export function PageHead({ title, sub }: { title: string; sub?: string }) {
	return (
		<header className="page__head">
			<h1 className="page__title">{title}</h1>
			{sub ? <p className="page__sub">{sub}</p> : null}
		</header>
	);
}
