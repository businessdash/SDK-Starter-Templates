import type { CustomerWorkBundle } from "@businessdash/sdk/contracts";
import type { CustomerSession } from "../../../utils/bd-portal";

/**
 * GET /api/bd/portal/context
 *
 * Everything the `my-account` page needs in one round-trip: whether
 * the portal is configured at all, the signed-in customer (or null),
 * and their work bundle. Reads the `bd_session` cookie server-side
 * and validates it with the SDK — the session token never reaches the
 * browser.
 */
export type PortalContext = {
	configured: boolean;
	session: {
		email: string | null;
		firstName: string | null;
		lastName: string | null;
		role: string | null;
	} | null;
	work: CustomerWorkBundle | null;
};

export default defineEventHandler(async (event): Promise<PortalContext> => {
	const configured = isCustomerPortalConfigured();
	if (!configured) return { configured: false, session: null, work: null };

	const session: CustomerSession | null = await getCustomerSession(event);
	if (!session) return { configured: true, session: null, work: null };

	let work: CustomerWorkBundle | null = null;
	try {
		work = await getCustomerWork(event);
	} catch {
		work = null;
	}

	return {
		configured: true,
		session: {
			email: session.user.email,
			firstName: session.user.firstName,
			lastName: session.user.lastName,
			role: session.role,
		},
		work,
	};
});
