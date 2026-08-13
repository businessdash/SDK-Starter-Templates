package app.biabstarter

import android.content.Context
import androidx.core.content.edit
import app.biab.BiabClient
import java.util.UUID

/**
 * App-wide BIAB wiring.
 *
 * `client` is null when `local.properties` has no site id / publishable key.
 * That is a supported state, not an error: screens render empty states and a
 * setup banner rather than crashing. A starter you can't launch before signing
 * up isn't a starter.
 */
object BiabApp {
    private const val PREFS = "biab"
    private const val VISITOR_KEY = "cart-visitor-token"

    @Volatile
    private var cached: BiabClient? = null

    fun client(): BiabClient? {
        cached?.let { return it }

        if (BuildConfig.BIAB_SITE_ID.isEmpty() || BuildConfig.BIAB_PK.isEmpty()) return null

        return synchronized(this) {
            cached ?: BiabClient(
                host = BuildConfig.BIAB_HOST,
                // ⚠️ Publishable token only — BuildConfig values land in the
                // APK, where `strings` finds them. BiabClient refuses an sk_.
                publishableKey = BuildConfig.BIAB_PK,
                siteId = BuildConfig.BIAB_SITE_ID,
            ).also { cached = it }
        }
    }

    val isConfigured: Boolean get() = client() != null

    /**
     * Stable per-install id for the cart.
     *
     * Generated locally — there is no endpoint that mints one, and the
     * platform keys the cart on whatever arrives in `X-BIAB-Cart-Visitor`. It
     * is an opaque id, NOT a secret, so SharedPreferences is correct for it
     * (a session token would belong in EncryptedSharedPreferences instead).
     *
     * Persisted so a cart survives a relaunch.
     */
    fun visitorToken(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.getString(VISITOR_KEY, null)?.let { return it }

        val token = UUID.randomUUID().toString()
        prefs.edit { putString(VISITOR_KEY, token) }
        return token
    }
}
