package app.bd

import kotlinx.serialization.Serializable

/**
 * A signed-in customer. The sign-in itself is the `bd-sign-in` module's
 * native screen (`BdSignIn`); this checks the session token it handed back.
 */
@Serializable
public data class TenantUser(
    val id: String,
    val email: String? = null,
    val firstName: String? = null,
    val lastName: String? = null,
) {
    /** "First Last", or the email when BD has no name. */
    public val displayName: String
        get() = listOfNotNull(firstName, lastName).joinToString(" ").ifEmpty { email.orEmpty() }
}

@Serializable
public data class TenantSession(
    val user: TenantUser,
    val organizationId: String,
    val role: String? = null,
)

/**
 * Who a session token belongs to, or null when BD no longer takes it
 * (expired, or another business's). Throws [BdException] when BD can't be
 * reached, so a caller can keep the token through a network blip.
 *
 * There's no sign-out call: BD's session tokens are signed, not stored, so
 * signing out is forgetting the token.
 */
public suspend fun BdClient.tenantSession(sessionToken: String): TenantSession? =
    get<TenantSession?>("auth/me", headers = mapOf("x-bd-session" to sessionToken))
