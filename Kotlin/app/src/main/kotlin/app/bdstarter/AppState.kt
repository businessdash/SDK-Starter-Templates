package app.bdstarter

import android.app.Application
import android.content.Context
import android.content.SharedPreferences
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.core.content.edit
import androidx.lifecycle.AndroidViewModel
import app.bd.BdClient
import app.bd.CartSnapshot
import app.bd.Product
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLDecoder

enum class Tab(val label: String) { Shop("Shop"), Cart("Cart"), Blog("Blog"), Form("Form"), Quiz("Quiz"), Account("Account") }

/** A screen opened over the tabs. */
sealed interface Route {
    data class Product(val id: String) : Route
    data object Wishlist : Route
    data object Compare : Route
    data object Reviews : Route
    data class Post(val slug: String) : Route
    data class Order(val sessionId: String) : Route
}

/** A route on the stack; the id tells two visits to the same product apart. */
data class Entry(val id: Long, val route: Route)

/** A product kept on this device: in the wishlist, picked to compare, or recently viewed. */
data class SavedProduct(val id: String, val name: String, val image: String?, val priceCents: Int?) {
    fun toJson(): JSONObject = JSONObject()
        .put("id", id)
        .put("name", name)
        .put("image", image ?: JSONObject.NULL)
        .put("priceCents", priceCents ?: JSONObject.NULL)

    companion object {
        fun of(product: Product) =
            SavedProduct(product.id, product.name, product.coverImage, product.cheapestPriceCents)

        fun fromJson(json: JSONObject): SavedProduct? {
            val id = json.optString("id").ifEmpty { return null }
            return SavedProduct(
                id = id,
                name = json.optString("name"),
                image = if (json.isNull("image")) null else json.optString("image").ifEmpty { null },
                priceCents = if (json.isNull("priceCents") || !json.has("priceCents")) null else json.optInt("priceCents"),
            )
        }
    }
}

/** A list of products kept in SharedPreferences, up to [limit]. */
class SavedList(private val key: String, val limit: Int, private val prefs: SharedPreferences) {
    val items = mutableStateListOf<SavedProduct>().apply { addAll(load()) }

    operator fun contains(id: String): Boolean = items.any { it.id == id }

    val isFull: Boolean get() = items.size >= limit

    /** Saved (at the end) if it wasn't, removed if it was. A full list takes nothing more. */
    fun toggle(product: SavedProduct) {
        if (product.id in this) remove(product.id) else if (!isFull) {
            items.add(product)
            save()
        }
    }

    /** First in the list, once; the oldest drops off past [limit]. */
    fun add(product: SavedProduct) {
        items.removeAll { it.id == product.id }
        items.add(0, product)
        while (items.size > limit) items.removeAt(items.lastIndex)
        save()
    }

    fun remove(id: String) {
        items.removeAll { it.id == id }
        save()
    }

    fun clear() {
        items.clear()
        save()
    }

    private fun load(): List<SavedProduct> = runCatching {
        val array = JSONArray(prefs.getString(key, null) ?: return emptyList())
        (0 until array.length()).mapNotNull { array.optJSONObject(it)?.let(SavedProduct::fromJson) }.take(limit)
    }.getOrDefault(emptyList())

    private fun save() = prefs.edit { putString(key, JSONArray(items.map { it.toJson() }).toString()) }
}

/**
 * What every screen shares: the client, the cart's visitor id, the open tab
 * and the screens over it, the saved lists, the cart badge and who's signed
 * in. Lives in [StarterViewModel], so it outlasts a rotation.
 */
class AppState(
    val client: BdClient?,
    val visitorToken: String,
    prefs: SharedPreferences,
    /** This app's URL scheme (its applicationId), where Stripe sends the customer back. */
    val returnScheme: String,
) {
    var tab by mutableStateOf(Tab.Shop)
    val stack = mutableStateListOf<Entry>()
    private var nextId = 0L

    var cartCount by mutableIntStateOf(0)
        private set

    /** The signed-in customer's session token, for likes, comments and reviews. */
    var sessionToken by mutableStateOf<String?>(null)
    val signedIn: Boolean get() = sessionToken != null

    val wishlist = SavedList("bd.wishlist", 60, prefs)
    val compare = SavedList("bd.compare", 4, prefs)
    val recentlyViewed = SavedList("bd.recently-viewed", 12, prefs)

    fun open(route: Route) {
        stack += Entry(nextId++, route)
    }

    /** Close the top screen. False when only the tabs are showing. */
    fun back(): Boolean {
        if (stack.isEmpty()) return false
        stack.removeAt(stack.lastIndex)
        return true
    }

    /** Close every screen and show [tab]. */
    fun showTab(tab: Tab) {
        stack.clear()
        this.tab = tab
    }

    fun noteCart(cart: CartSnapshot) {
        cartCount = cart.units
    }

    /** Stripe's success address, which comes back to this app with the session id. */
    val checkoutSuccessUrl: String get() = "$returnScheme://checkout/success?session_id={CHECKOUT_SESSION_ID}"
    val checkoutCancelUrl: String get() = "$returnScheme://checkout/cancel"

    /**
     * Stripe sent the customer back: show the order when it went through, the
     * cart when they turned back. False for any other link.
     */
    fun checkoutReturned(url: String?): Boolean {
        val prefix = "$returnScheme://checkout/"
        if (url == null || !url.startsWith(prefix, ignoreCase = true)) return false
        val rest = url.substring(prefix.length)
        val sessionId = Regex("[?&]session_id=([^&#]+)").find(rest)?.groupValues?.get(1)
            ?.let { URLDecoder.decode(it, "UTF-8") }
        showTab(Tab.Cart)
        if (rest.startsWith("success") && sessionId != null) open(Route.Order(sessionId))
        return true
    }
}

val LocalApp = staticCompositionLocalOf<AppState> { error("No AppState: wrap the screens in StarterApp.") }

/** Holds the [AppState] for the activity. */
class StarterViewModel(app: Application) : AndroidViewModel(app) {
    val state = AppState(
        client = BdApp.client(),
        visitorToken = BdApp.visitorToken(app),
        prefs = app.getSharedPreferences("bd-shop", Context.MODE_PRIVATE),
        returnScheme = app.packageName.lowercase(),
    )
}
