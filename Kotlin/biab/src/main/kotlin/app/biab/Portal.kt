package app.biab

import io.ktor.http.encodeURLPathPart
import kotlinx.serialization.json.JsonElement

/**
 * The customer portal, and the notification settings that hang off it.
 *
 * ## Every call is scoped to a signed-in customer
 *
 * [sessionToken] identifies the PERSON. Without it these routes are
 * unauthenticated, which does not error so much as return an empty portal —
 * and an empty portal reads like a bug in your own code.
 *
 * ## [organizationId] chooses WHOSE data
 *
 * A customer can buy from several businesses on this platform. The org id says
 * which tenant's records to read; the server still checks the customer belongs
 * to it, so passing one widens nothing.
 *
 * It matters most for notification preferences, which are stored per
 * (org, customer): muting marketing email from one company must not mute it
 * from the others. They are separate relationships, and collapsing them into a
 * single setting would either leak a decision across companies or force the
 * customer to accept the loudest of them.
 *
 * Build one of these per company from [otherOrgs].
 */
public class PortalResource internal constructor(
    private val client: BiabClient,
    private val sessionToken: String,
    private val organizationId: String? = null,
) {
    private val headers: Map<String, String>
        get() = buildMap {
            put("X-BIAB-Session-Token", sessionToken)
            organizationId?.let { put("X-BIAB-Customer-Portal-Org", it) }
        }

    /** Org branding and which portal features are on. Call before rendering. */
    public suspend fun context(): JsonElement =
        client.get("customer-portal/context", emptyMap(), headers)

    /** The work feed: jobs, quotes, invoices and orders in one bundle. */
    public suspend fun work(): JsonElement =
        client.get("customer-portal/work", emptyMap(), headers)

    public suspend fun profile(): JsonElement =
        client.get("customer-portal/profile", emptyMap(), headers)

    /**
     * The other companies this customer belongs to.
     *
     * Each returned `orgId` builds another [PortalResource] — that is how a
     * dashboard offers per-company notification settings.
     */
    public suspend fun otherOrgs(): JsonElement =
        client.get("customer-portal/other-orgs", emptyMap(), headers)

    public suspend fun orders(limit: Int? = null): JsonElement =
        client.get("customer-portal/orders", mapOf("limit" to limit?.toString()), headers)

    public suspend fun order(id: String): JsonElement =
        client.get("customer-portal/orders/${id.encodeURLPathPart()}", emptyMap(), headers)

    /** `unpaid = true` filters on the computed BALANCE, not the status string. */
    public suspend fun invoices(unpaid: Boolean = false): JsonElement =
        client.get(
            "customer-portal/invoices",
            mapOf("unpaid" to if (unpaid) "1" else null),
            headers,
        )

    public suspend fun quotes(status: String? = null): JsonElement =
        client.get("customer-portal/quotes", mapOf("status" to status), headers)

    public suspend fun contracts(status: String? = null): JsonElement =
        client.get("customer-portal/contracts", mapOf("status" to status), headers)

    public suspend fun shipments(active: Boolean = false): JsonElement =
        client.get(
            "customer-portal/shipments",
            mapOf("active" to if (active) "1" else null),
            headers,
        )

    // ── Notification preferences ──────────────────────────────────────────

    /**
     * This company's preference matrix, plus the category and channel
     * definitions needed to render it.
     */
    public suspend fun notificationPreferences(): JsonElement =
        client.get("customer-portal/notification-preferences", emptyMap(), headers)

    /**
     * Merge a sparse preference update into this company's stored matrix.
     *
     * Send `mapOf("marketing" to mapOf("email" to false))` and only that flips;
     * send the full matrix to overwrite. The response is the MERGED result and
     * that is what you should render — echoing the request back shows the
     * customer a matrix the server never agreed to.
     */
    public suspend fun updateNotificationPreferences(
        preferences: Map<String, Map<String, Boolean>>,
    ): JsonElement = client.post(
        "customer-portal/notification-preferences",
        mapOf("preferences" to preferences),
        headers,
    )

    /**
     * Send a verification link (`kind = "email"`, 15-minute TTL) or a 6-digit
     * OTP (`kind = "phone"`, 5 minutes) to [destination].
     *
     * A destination stays **inert until verified**. That is the point of the
     * flow, not an inconvenience in it: without it anyone holding a session
     * could point a company's notifications at an address they do not control.
     */
    public suspend fun startVerification(kind: String, destination: String): JsonElement =
        client.post(
            "notifications/preferences/verify",
            mapOf("kind" to kind, "destination" to destination),
            headers,
        )

    public suspend fun startEmailVerification(destination: String): JsonElement =
        startVerification("email", destination)

    public suspend fun startPhoneVerification(destination: String): JsonElement =
        startVerification("phone", destination)

    /**
     * Consume the token from the email link or the SMS code.
     *
     * Takes only the token: the server already knows which destination it was
     * issued for, and accepting a caller-supplied one would let a token minted
     * for one address verify another.
     */
    public suspend fun confirmVerification(token: String): JsonElement =
        client.post(
            "notifications/preferences/verify/confirm",
            mapOf("token" to token),
            headers,
        )
}

/**
 * The portal for one company.
 *
 * Pass [organizationId] from `otherOrgs()` to read or write a different
 * company's data — notification preferences especially, which are stored per
 * company.
 */
public fun BiabClient.portal(
    sessionToken: String,
    organizationId: String? = null,
): PortalResource = PortalResource(this, sessionToken, organizationId)
