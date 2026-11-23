package app.bd.signin

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * Where sign-in goes. A business's customers have their own account at that
 * business: their own password, their own codes, nothing shared with another
 * business on BD. These calls are BD's `auth/customer/` routes.
 *
 * Those routes need a key, and a native app holds no secret, so the usual
 * backend is [BdServerSignInBackend]: the app's own server takes the same
 * JSON, adds its key, and hands back its own session `S`.
 */
public interface BdSignInBackend<S> {
    /** The business's name and which ways to sign in it offers. */
    public suspend fun options(): BdSignInOptions
    public suspend fun signIn(email: String, password: String): S
    /** Emails a code. The account is made when the code comes back ([verify]). */
    public suspend fun startSignUp(email: String, password: String, firstName: String?, lastName: String?): BdCodeSent
    /** Emails a code for a new password. Unknown emails get the same answer, so nobody can probe who has an account. */
    public suspend fun startReset(email: String): BdCodeSent
    /** The emailed code: makes the account, or sets [newPassword], and signs in. */
    public suspend fun verify(pendingId: String, code: String, newPassword: String?): S
    /** An ID token from Sign in with Google (Credential Manager) or Apple, checked by BD against the business's app. */
    public suspend fun signIn(provider: BdSignInProvider, idToken: String, nonce: String?, firstName: String?, lastName: String?): S
}

public data class BdSignInOptions(
    /** The business's name, as BD knows it. */
    val name: String? = null,
    val password: Boolean = true,
    val apple: Boolean = false,
    val google: Boolean = false,
)

/** A code is on its way (or would be, for an email with no account). */
public data class BdCodeSent(val pendingId: String, val expiresAt: String)

public enum class BdSignInProvider(public val wire: String) { Apple("apple"), Google("google") }

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
 * Sign-in through the app's own server. It takes BD's request bodies at
 * [baseUrl] + `options` (GET), `sign-in`, `sign-up`, `forgot-password`,
 * `verify` and `id-token` (POST), passes them to BD's `auth/customer/` with
 * its key, and answers with:
 *
 * - `sign-up`, `forgot-password`: `{ pendingId, expiresAt }`
 * - `sign-in`, `verify`, `id-token`: its own session, read by [readSession]
 * - a problem: `{ error, message }` with a 4xx or 5xx status
 */
public class BdServerSignInBackend<S>(
    private val baseUrl: String,
    private val headers: Map<String, String> = emptyMap(),
    /** Reads a sign-in's reply body (JSON text) into the app's session. */
    private val readSession: (String) -> S,
) : BdSignInBackend<S> {

    override suspend fun options(): BdSignInOptions = call("options", null).let { o ->
        BdSignInOptions(
            name = o.optString("name").takeIf { o.has("name") && !o.isNull("name") },
            password = o.optBoolean("password", true),
            apple = o.optBoolean("apple", false),
            google = o.optBoolean("google", false),
        )
    }

    override suspend fun signIn(email: String, password: String): S =
        session("sign-in", JSONObject().put("email", email).put("password", password))

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
}
