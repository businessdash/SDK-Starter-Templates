"use client";

import { SignIn, SignOut, SignUp, useUser } from "@businessdash/sdk/react";

/**
 * WorkOS-backed BIAB auth entry points. Each renders an anchor to the
 * `/api/biab-auth/*` handler, which redirects to the hosted WorkOS page and
 * sets the `biab_session` cookie on return.
 *
 * `useUser()` reads the current session from the handler's `/me` route, so the
 * header can swap between "Sign in / Create account" and "My account / Sign
 * out" without a server round-trip in the layout.
 */
export function HeaderAuth() {
	const state = useUser();

	if (state.status === "loading") {
		return <span className="header-auth__loading">…</span>;
	}

	if (state.status === "signed-in") {
		const me = state.user.user;
		const name = me.firstName?.trim() || me.email || "My account";
		return (
			<span className="header-auth">
				<a href="/my-account">{name}</a>
				<SignOut className="header-auth__link">Sign out</SignOut>
			</span>
		);
	}

	return (
		<span className="header-auth">
			<SignIn className="header-auth__link" returnTo="/my-account">
				Sign in
			</SignIn>
			<SignUp className="biab-btn header-auth__cta" returnTo="/my-account">
				Create account
			</SignUp>
		</span>
	);
}

/** Standalone sign-out anchor — clears the `biab_session` cookie via the handler. */
export function SignOutLink({ className }: { className?: string }) {
	return (
		<SignOut className={className ?? "header-auth__link"}>Sign out</SignOut>
	);
}

/** Sign-in + create-account block for the my-account signed-out state. */
export function AuthButtons({
	returnTo = "/my-account",
}: {
	returnTo?: string;
}) {
	return (
		<div className="auth-buttons">
			<SignIn className="biab-btn" returnTo={returnTo}>
				Sign in
			</SignIn>
			<SignUp className="biab-btn biab-btn--ghost" returnTo={returnTo}>
				Create an account
			</SignUp>
		</div>
	);
}
