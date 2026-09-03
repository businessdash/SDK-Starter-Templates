/**
 * BD → consumer webhook receiver.
 *
 * Register this URL in BD at /dashboard/settings/integrations
 * and paste the revealed `whsec_…` value into
 * `BD_REVALIDATION_SECRET`. The SDK's drop-in Next handler
 * verifies the HMAC + replay window and calls `revalidateTag`
 * for every tag in the payload.
 *
 * One-line export — the handler reads `BD_REVALIDATION_SECRET`
 * from env automatically.
 */
export { POST } from "@businessdash/sdk/next/revalidate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
