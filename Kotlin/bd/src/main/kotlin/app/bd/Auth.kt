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

/** [deleteAccount]'s answer. `signInKept` when the person's sign-in stays for another business. */
@Serializable
public data class AccountDeleted(
    val deleted: Boolean,
    val signInKept: Boolean = false,
)

/**
 * Deletes the signed-in customer's account with this business: their customer
 * record, applications, settings and cart, and their sign-in unless another
 * business still uses it. Orders and invoices stay with the business. The
 * token stops working. Google Play and the App Store both require every app
 * that makes accounts to offer this in the app.
 *
 * Throws [BdHttpException] with status 401 when the session has already
 * expired (sign in again, then delete), and [BdException] when BD can't be
 * reached.
 */
public suspend fun BdClient.deleteAccount(sessionToken: String): AccountDeleted =
    post<AccountDeleted>("auth/customer/delete-account", headers = mapOf("x-bd-session" to sessionToken))
