"use client";

import { BdSignIn } from "@businessdash/sdk/react";

/**
 * The business's own sign-in screen — the same one as the Swift and Kotlin
 * apps: sign in, create an account (confirmed by an emailed code), reset a
 * password, and "Continue with Google / Apple / GitHub / Discord" for the
 * providers the business turned on. Its name, logo and brand colours come
 * from BD (Settings → Branding); every box is checked as it's left and again
 * on submit.
 *
 * It talks to the `/api/bd-auth` handler, which runs each step through BD
 * (WorkOS underneath) and sets the `bd_session` cookie; then it comes back to
 * /my-account, signed in.
 */
export function SignInScreen({
	start = "signIn",
}: {
	start?: "signIn" | "createAccount";
}) {
	return (
		<BdSignIn
			start={start}
			redirectTo="/my-account"
			brand={{ tagline: "Sign in to see your jobs, quotes, and invoices." }}
		/>
	);
}
