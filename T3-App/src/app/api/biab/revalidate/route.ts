/**
 * BIAB → consumer webhook receiver.
 *
 * Register this URL in BIAB at /dashboard/settings/integrations
 * and paste the revealed `whsec_…` value into
 * `BIAB_REVALIDATION_SECRET`. The SDK's drop-in Next handler
 * verifies the HMAC + replay window and calls `revalidateTag`
 * for every tag in the payload.
 *
 * One-line export — the handler reads `BIAB_REVALIDATION_SECRET`
 * from env automatically.
 */
export { POST } from "@businessdash/sdk/next/revalidate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
