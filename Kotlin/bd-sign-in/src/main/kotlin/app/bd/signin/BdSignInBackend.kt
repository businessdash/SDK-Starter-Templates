package app.bd.signin

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * Where sign-in goes: BD's `auth/customer/` routes, which run every password,
 * code and provider sign-in through WorkOS — the same accounts as BD's hosted
 * sign-in, so a password, Google, Apple, GitHub and Discord all reach one
 * person.
 *
 * Those routes take the business's **publishable** key (`tenant_auth:public`
 * is in the publishable scope set), so an app can call BD directly with
 * [BdServerSignInBackend.businessDash]. An app whose server keeps the BD key
 * instead points [BdServerSignInBackend] at its own routes, which take the
 * same JSON and hand back the server's own session `S`.
 */
public interface BdSignInBackend<S> {
    /** The business's name and which ways to sign in it offers. */
    public suspend fun options(): BdSignInOptions
    /**
     * Signed in — or, when WorkOS wants the email confirmed first, a code sent
     * to it (finish with [verify], no new password).
     */
    public suspend fun signIn(email: String, password: String): BdPasswordSignIn<S>
    /** Emails a code. The account is made when the code comes back ([verify]). */
    public suspend fun startSignUp(email: String, password: String, firstName: String?, lastName: String?): BdCodeSent
    /** Emails a code for a new password. Unknown emails get the same answer, so nobody can probe who has an account. */
    public suspend fun startReset(email: String): BdCodeSent
    /** The emailed code: makes the account, or sets [newPassword], and signs in. */
    public suspend fun verify(pendingId: String, code: String, newPassword: String?): S
    /** An ID token from Sign in with Google (Credential Manager) or Apple, checked by BD against the business's app. */
    public suspend fun signIn(provider: BdSignInProvider, idToken: String, nonce: String?, firstName: String?, lastName: String?): S

    /**
     * "Continue with …": WorkOS's link for [provider]. The sign-in comes back to
     * [redirectUri] (the app's own scheme) with `bd_oauth_code`.
     */
    public suspend fun startOAuth(provider: BdOAuthProvider, redirectUri: String, codeChallenge: String): String =
        throw BdSignInException.unavailable()

    /** Redeems a provider sign-in's `bd_oauth_code` with the PKCE verifier behind its challenge. */
    public suspend fun finishOAuth(code: String, codeVerifier: String): S = throw BdSignInException.unavailable()
}

/** What a password sign-in comes to. */
public sealed interface BdPasswordSignIn<out S> {
    public data class SignedIn<S>(val session: S) : BdPasswordSignIn<S>
    /** WorkOS wants the email confirmed first and has emailed a code. */
    public data class ConfirmEmail(val sent: BdCodeSent) : BdPasswordSignIn<Nothing>
}

public data class BdSignInOptions(
    /** The business's name, as BD knows it. */
    val name: String? = null,
    val password: Boolean = true,
    /** Google / Apple from the app's own sign-in (an ID token; the business listed its apps). */
    val apple: Boolean = false,
    val google: Boolean = false,
    /** "Continue with …" links, through WorkOS, in BD's order. */
    val oauth: List<BdOAuthProvider> = emptyList(),
    /**
     * The business's brand colours (Settings → Branding), `#rrggbb`: the
     * primary for the main button, the secondary for links. Null (or an
     * older BD that doesn't send them): the app's own.
     */
    val primaryColor: String? = null,
    val secondaryColor: String? = null,
    /** The business's logo (https), shown when the app gives none. */
    val logoUrl: String? = null,
)

/** A code is on its way (or would be, for an email with no account). */
public data class BdCodeSent(val pendingId: String, val expiresAt: String)

/** The providers whose ID token the app can get itself (Credential Manager for Google). */
public enum class BdSignInProvider(public val wire: String) { Apple("apple"), Google("google") }

/** The "Continue with …" providers, in the order the screen shows them. */
public enum class BdOAuthProvider(public val wire: String) {
    Apple("apple"), Google("google"), GitHub("github"), Discord("discord");

    public companion object {
        public fun fromWire(wire: String): BdOAuthProvider? = entries.firstOrNull { it.wire == wire }
    }
}

/** An ID token from the app's own Google sign-in, with the raw nonce if it set one. */
public data class BdIdToken(val idToken: String, val nonce: String? = null)

/**
 * What went wrong, in words the person can act on. [code] is BD's
 * (`invalid_credentials`, `invalid_code`, `code_expired`, `weak_password`,
 * `locked`, `too_many_tries`, …), or `offline` / `unavailable`.
 */
public class BdSignInException(public val code: String, message: String) : Exception(message) {
    public companion object {
        public fun offline(): BdSignInException = BdSignInException("offline", "You're offline. Check your connection and try again.")
        public fun unavailable(): BdSignInException = BdSignInException("unavailable", "Sign-in isn't available just now. Try again in a minute.")
    }
}

/**
 * What BD's sign-in routes answer: who signed in, at which business, and the
 * token for `x-bd-session` (`auth/me`, the customer portal, …). Always a
 * customer session: [role] is null.
 */
public data class BdSignInSession(
    val userId: String,
    val email: String?,
    val firstName: String?,
    val lastName: String?,
    val organizationId: String,
    val role: String?,
    val sessionToken: String,
    /** ISO 8601. */
    val expiresAt: String,
) {
    /** "First Last", or the email when BD has no name. */
    public val displayName: String
        get() = listOfNotNull(firstName, lastName).joinToString(" ").ifEmpty { email.orEmpty() }

    public companion object {
        /** BD's reply: `{ user: { id, email, firstName, lastName }, organizationId, role, sessionToken, expiresAt }`. */
        public fun parse(json: String): BdSignInSession {
            val o = JSONObject(json)
            val user = o.getJSONObject("user")
            fun JSONObject.text(name: String): String? = if (has(name) && !isNull(name)) getString(name) else null
            return BdSignInSession(
                userId = user.getString("id"),
                email = user.text("email"),
                firstName = user.text("firstName"),
                lastName = user.text("lastName"),
                organizationId = o.getString("organizationId"),
                role = o.text("role"),
                sessionToken = o.getString("sessionToken"),
                expiresAt = o.text("expiresAt").orEmpty(),
            )
        }
    }
}

/**
 * Sign-in through BD ([businessDash]) or the app's own server. It takes BD's request bodies at
 * [baseUrl] + `options` (GET), `sign-in`, `sign-up`, `forgot-password`,
 * `verify` and `id-token` (POST), passes them to BD's `auth/customer/` with
 * its key, and answers with:
 *
 * - `sign-up`, `forgot-password`: `{ pendingId, expiresAt }`
 * - `sign-in`: its own session, read by [readSession] — or `{ pendingId,
 *   expiresAt }` when the email must be confirmed first
 * - `verify`, `id-token`, `oauth/exchange`: its own session
 * - `oauth/start`: `{ url }`
 * - a problem: `{ error, message }` with a 4xx or 5xx status
 */
public class BdServerSignInBackend<S>(
    private val baseUrl: String,
    private val headers: Map<String, String> = emptyMap(),
    /** Reads a sign-in's reply body (JSON text) into the app's session. */
    private val readSession: (String) -> S,
) : BdSignInBackend<S> {

    override suspend fun options(): BdSignInOptions = call("options", null).let { o ->
        fun text(name: String) = o.optString(name).takeIf { o.has(name) && !o.isNull(name) && it.isNotEmpty() }
        val links = o.optJSONArray("oauth")
        BdSignInOptions(
            name = text("name"),
            password = o.optBoolean("password", true),
            apple = o.optBoolean("apple", false),
            google = o.optBoolean("google", false),
            oauth = (0 until (links?.length() ?: 0)).mapNotNull { BdOAuthProvider.fromWire(links!!.optString(it)) }.distinct(),
            primaryColor = text("primaryColor"),
            secondaryColor = text("secondaryColor"),
            logoUrl = text("logoUrl"),
        )
    }

    override suspend fun signIn(email: String, password: String): BdPasswordSignIn<S> {
        val text = send("sign-in", JSONObject().put("email", email).put("password", password))
        val o = runCatching { JSONObject(text) }.getOrNull()
        if (o != null && o.optString("pendingId").isNotEmpty() && !o.has("sessionToken")) {
            return BdPasswordSignIn.ConfirmEmail(sent(o))
        }
        return BdPasswordSignIn.SignedIn(runCatching { readSession(text) }.getOrElse { throw BdSignInException.unavailable() })
    }

    override suspend fun startOAuth(provider: BdOAuthProvider, redirectUri: String, codeChallenge: String): String {
        val url = call(
            "oauth/start",
            JSONObject().put("provider", provider.wire).put("redirectUri", redirectUri).put("codeChallenge", codeChallenge),
        ).optString("url")
        if (url.isEmpty()) throw BdSignInException.unavailable()
        return url
    }

    override suspend fun finishOAuth(code: String, codeVerifier: String): S =
        session("oauth/exchange", JSONObject().put("code", code).put("codeVerifier", codeVerifier))

    override suspend fun startSignUp(email: String, password: String, firstName: String?, lastName: String?): BdCodeSent =
        sent(call("sign-up", JSONObject().put("email", email).put("password", password).putOpt("firstName", firstName).putOpt("lastName", lastName)))

    override suspend fun startReset(email: String): BdCodeSent =
        sent(call("forgot-password", JSONObject().put("email", email)))

    override suspend fun verify(pendingId: String, code: String, newPassword: String?): S =
        session("verify", JSONObject().put("pendingId", pendingId).put("code", code).putOpt("newPassword", newPassword))

    override suspend fun signIn(provider: BdSignInProvider, idToken: String, nonce: String?, firstName: String?, lastName: String?): S =
        session(
            "id-token",
            JSONObject().put("provider", provider.wire).put("idToken", idToken)
                .putOpt("nonce", nonce).putOpt("firstName", firstName).putOpt("lastName", lastName),
        )

    private fun sent(o: JSONObject): BdCodeSent {
        val id = o.optString("pendingId")
        if (id.isEmpty()) throw BdSignInException.unavailable()
        return BdCodeSent(id, o.optString("expiresAt"))
    }

    private suspend fun session(path: String, body: JSONObject): S {
        val text = send(path, body)
        return runCatching { readSession(text) }.getOrElse { throw BdSignInException.unavailable() }
    }

    private suspend fun call(path: String, body: JSONObject?): JSONObject =
        runCatching { JSONObject(send(path, body)) }.getOrElse {
            if (it is BdSignInException) throw it else throw BdSignInException.unavailable()
        }

    private suspend fun send(path: String, body: JSONObject?): String = withContext(Dispatchers.IO) {
        val connection = try {
            (URL(baseUrl.trimEnd('/') + "/" + path).openConnection() as HttpURLConnection).apply {
                connectTimeout = 15_000
                readTimeout = 30_000
                setRequestProperty("Accept", "application/json")
                for ((name, value) in headers) setRequestProperty(name, value)
                if (body != null) {
                    requestMethod = "POST"
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    outputStream.use { it.write(body.toString().toByteArray()) }
                }
            }
        } catch (_: IOException) {
            throw BdSignInException.offline()
        }
        try {
            val status = try { connection.responseCode } catch (_: IOException) { throw BdSignInException.offline() }
            val text = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (status !in 200..299) {
                val problem = runCatching { JSONObject(text) }.getOrNull()
                val message = problem?.optString("message").orEmpty()
                throw when {
                    message.isNotEmpty() -> BdSignInException(problem?.optString("error")?.ifEmpty { null } ?: "failed", message)
                    status == 429 -> BdSignInException("too_many_tries", "That's a lot of tries. Wait a few minutes, then try again.")
                    else -> BdSignInException.unavailable()
                }
            }
            text
        } finally {
            connection.disconnect()
        }
    }

    public companion object {
        /**
         * Straight to BD's `auth/customer/` routes with the business's
         * publishable `pk_…` key, the one the app already ships. No server needed.
         */
        public fun businessDash(
            publishableKey: String,
            host: String = "https://www.businessdash.us",
        ): BdServerSignInBackend<BdSignInSession> {
            require(!publishableKey.startsWith("sk_")) { "Use the publishable pk_ key in an app, never a secret sk_ key." }
            return BdServerSignInBackend(
                baseUrl = host.trimEnd('/') + "/api/package/v1/auth/customer",
                headers = mapOf("Authorization" to "Bearer $publishableKey"),
                readSession = BdSignInSession::parse,
            )
        }
    }
}
