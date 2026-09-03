import type { PageServerLoad } from "./$types";

import {
	fetchBundleSafe,
	getUpdatesFromBundle,
} from "$lib/server/bd-bundle";

/**
 * News / updates feed. Reads the Google-Business-style "Posts" that ride
 * along on the marketing bundle as `bundle.updates`. Empty (placeholder)
 * until the org has connected its Google profile or posted updates.
 */
export const load: PageServerLoad = async () => {
	const result = await fetchBundleSafe("home", "en");
	if (result.status === "unavailable") {
		return { configured: true as const, unavailable: true as const, updates: [] };
	}
	return {
		configured: true as const,
		unavailable: false as const,
		updates: getUpdatesFromBundle(result.bundle),
	};
};
