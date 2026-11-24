"use client";

import { SignOut, useUser } from "@businessdash/sdk/react";

/**
 * The header's account links. Signing in happens on /my-account, the
 * business's own sign-in screen (`<BdSignIn>`); signing out clears the
 * `bd_session` cookie through the `/api/bd-auth` handler.
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
			<a className="header-auth__link" href="/my-account">
				Sign in
			</a>
			<a className="bd-btn header-auth__cta" href="/my-account?start=create">
				Create account
			</a>
		</span>
	);
}

/** Standalone sign-out anchor — clears the `bd_session` cookie via the handler. */
export function SignOutLink({ className }: { className?: string }) {
	return (
		<SignOut className={className ?? "header-auth__link"}>Sign out</SignOut>
	);
}
