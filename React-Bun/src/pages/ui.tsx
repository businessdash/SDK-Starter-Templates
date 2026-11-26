/** Shared bits for the feature pages: an error box and a heading. The fetch hook is `use-api.ts`. */

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
