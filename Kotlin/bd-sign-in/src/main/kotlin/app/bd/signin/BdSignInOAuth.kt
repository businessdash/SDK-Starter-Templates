package app.bd.signin

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Base64
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.security.MessageDigest
import java.security.SecureRandom

/**
 * "Continue with Google / Apple / GitHub / Discord" on Android: WorkOS's link
 * for the provider opens in a Custom Tab (the browser's own sign-in, where the
 * person may already be signed in to the provider — Google refuses embedded
 * web views), and comes back to the app at `{packageName}://bd-oauth` with a
 * code only this sign-in's PKCE verifier can redeem.
 *
 * [BdSignInRedirectActivity] (declared by this module's manifest, on the
 * app's own `applicationId` as the scheme) receives that, hands it to
 * [returns] and brings the app back. No setup in the app — but its
 * `applicationId` must be lowercase, as URL schemes are.
 */
public object BdSignInOAuth {
    private val returned = MutableStateFlow<Uri?>(null)

    /** The latest provider sign-in to come back, until [consume]d. */
    public val returns: StateFlow<Uri?> = returned.asStateFlow()

    /** Where provider sign-ins come back to, for this app. */
    public fun redirectUri(context: Context): String = "${context.packageName.lowercase()}://$HOST"

    internal fun deliver(uri: Uri) {
        returned.value = uri
    }

    internal fun consume(uri: Uri) {
        returned.compareAndSet(uri, null)
    }

    /**
     * Opens [url] in a Custom Tab where the browser has them (the plain
     * Custom Tabs intent — no extra library), else the browser.
     */
    public fun open(context: Context, url: String) {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
            // A Custom Tabs request: the session extra, even when null.
            putExtras(Bundle().apply { putBinder(EXTRA_SESSION, null) })
            putExtra(EXTRA_SHARE_STATE, SHARE_STATE_OFF)
            if (context !is Activity) addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        try {
            context.startActivity(intent)
        } catch (_: ActivityNotFoundException) {
            throw BdSignInException("no_browser", "There's no browser on this phone to sign in with. Use your email instead.")
        }
    }

    /** A PKCE pair (RFC 7636, S256): the verifier stays here, the challenge goes to BD. */
    internal fun newPkcePair(): Pair<String, String> {
        val bytes = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val verifier = base64Url(bytes)
        val challenge = base64Url(MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray(Charsets.US_ASCII)))
        return verifier to challenge
    }

    internal fun base64Url(bytes: ByteArray): String =
        Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)

    internal const val HOST: String = "bd-oauth"
    private const val EXTRA_SESSION = "android.support.customtabs.extra.SESSION"
    private const val EXTRA_SHARE_STATE = "androidx.browser.customtabs.extra.SHARE_STATE"
    private const val SHARE_STATE_OFF = 2
}

/**
 * Where a provider sign-in lands: hands the URL to [BdSignInOAuth.returns],
 * then brings the app's own screen back to the front — clearing the Custom
 * Tab above it — and steps aside.
 */
public class BdSignInRedirectActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        intent?.data?.let(BdSignInOAuth::deliver)
        packageManager.getLaunchIntentForPackage(packageName)?.let { launch ->
            launch.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            startActivity(launch)
        }
        finish()
    }
}
