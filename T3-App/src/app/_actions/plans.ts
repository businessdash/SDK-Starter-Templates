// [bd-file:saas]
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { setPlanCancelled, startPlanCheckout } from "@/server/lib/bd-portal";

/**
 * Plans: subscribe, cancel, and take a cancel back. Plain form actions that
 * answer with a redirect, so the pages need no client code.
 */

const SIGN_IN = "/my-account?next=/store/subscriptions";

async function siteOrigin(): Promise<string> {
	const h = await headers();
	const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
	const proto =
		h.get("x-forwarded-proto") ??
		(host.startsWith("localhost") ? "http" : "https");
	return `${proto}://${host}`;
}

/** Hand the signed-in customer to Stripe; a visitor signs in first. */
export async function subscribeAction(formData: FormData): Promise<void> {
	const planId = String(formData.get("planId") ?? "");
	if (!planId) redirect("/store/subscriptions?error=checkout");
	const origin = await siteOrigin();
	let target: string;
	try {
		const res = await startPlanCheckout(planId, {
			successUrl: `${origin}/store/order?session_id={CHECKOUT_SESSION_ID}`,
			cancelUrl: `${origin}/store/subscriptions`,
		});
		target = res ? res.url : SIGN_IN;
	} catch {
		target = "/store/subscriptions?error=checkout";
	}
	redirect(target);
}

/**
 * Cancel at the end of the paid period, or take the cancel back. `?plan=`
 * says what happened, because the stored status lags until the payment
 * provider confirms.
 */
export async function changePlanAction(formData: FormData): Promise<void> {
	const intent = formData.get("intent");
	let result = "error";
	if (intent === "cancel" || intent === "resume") {
		try {
			await setPlanCancelled(intent === "cancel");
			result = intent === "cancel" ? "cancelled" : "resumed";
		} catch {
			result = "error";
		}
	}
	redirect(`/my-account?plan=${result}`);
}
