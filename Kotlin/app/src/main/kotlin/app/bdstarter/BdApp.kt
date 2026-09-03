package app.bdstarter

import android.content.Context
import androidx.core.content.edit
import app.bd.BdClient
import java.util.UUID

/**
 * App-wide BD wiring.
 *
 * `client` is null when `local.properties` has no site id / publishable key.
 * That is a supported state, not an error: screens render empty states and a
 * setup banner rather than crashing. A starter you can't launch before signing
 * up isn't a starter.
 */
object BdApp {
    private const val PREFS = "bd"
    private const val VISITOR_KEY = "cart-visitor-token"

    @Volatile
    private var cached: BdClient? = null

    fun client(): BdClient? {
        cached?.let { return it }

        if (BuildConfig.BD_SITE_ID.isEmpty() || BuildConfig.BD_PK.isEmpty()) return null

        return synchronized(this) {
            cached ?: BdClient(
                host = BuildConfig.BD_HOST,
                // ⚠️ Publishable token only — BuildConfig values land in the
                // APK, where `strings` finds them. BdClient refuses an sk_.
                publishableKey = BuildConfig.BD_PK,
                siteId = BuildConfig.BD_SITE_ID,
            ).also { cached = it }
        }
    }

    val isConfigured: Boolean get() = client() != null

    /**
     * Stable per-install id for the cart.
     *
     * Generated locally — there is no endpoint that mints one, and the
     * platform keys the cart on whatever arrives in `X-BD-Cart-Visitor`. It
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
