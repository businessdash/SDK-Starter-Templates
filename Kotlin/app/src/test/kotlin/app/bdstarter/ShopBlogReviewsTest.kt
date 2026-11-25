package app.bdstarter

import android.content.Context
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.ui.test.SemanticsNodeInteractionsProvider
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextReplacement
import app.bd.BdClient
import app.bd.Reviews
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.Headers
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.http.Parameters
import io.ktor.http.content.TextContent
import io.ktor.http.headersOf
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.util.concurrent.CopyOnWriteArrayList

/** What the app sent: enough of a request to check. */
data class Sent(val method: HttpMethod, val path: String, val query: Parameters, val headers: Headers, val body: JsonElement?)

/**
 * A small BD: a store with two categories, a cart that takes a coupon, a
 * blog, and fourteen business reviews. It records what the app sent.
 */
class FakeBd {
    val requests = CopyOnWriteArrayList<Sent>()
    val cart = CopyOnWriteArrayList<JsonObject>()
    @Volatile var coupon: String? = null
    @Volatile var likes = 3
    @Volatile var liked = false
    val comments = CopyOnWriteArrayList<JsonObject>()
    @Volatile var review: JsonElement? = null

    val client = BdClient(
        host = "https://bd.test",
        publishableKey = "pk_test",
        siteId = "site-1",
        engine = MockEngine { request ->
            val text = (request.body as? TextContent)?.text
            val sent = Sent(
                request.method,
                request.url.encodedPath.removePrefix("/api/package/v1/"),
                request.url.parameters,
                request.headers,
                text?.let(Json::parseToJsonElement),
            )
            requests += sent
            val (status, answer) = handle(sent)
            respond(answer, HttpStatusCode.fromValue(status), headersOf(HttpHeaders.ContentType, "application/json"))
        },
    )

    private fun cartJson(): String = buildJsonObject {
        put("items", JsonArray(cart.toList()))
        put("subtotal", cart.sumOf { it["subtotal"]!!.jsonPrimitive.int })
        put("currency", "USD")
        put("couponCode", coupon?.let(::JsonPrimitive) ?: JsonNull)
        put("itemCount", cart.sumOf { it["quantity"]!!.jsonPrimitive.int })
    }.toString()

    private fun handle(sent: Sent): Pair<Int, String> {
        val body = sent.body as? JsonObject
        return when (sent.method.value to sent.path) {
            "GET" to "storefront/products" -> {
                val category = sent.query["categoryId"]
                val search = sent.query["search"]?.lowercase()
                val items = PRODUCTS.filter { product ->
                    (category == null || product.str("categoryId") == category) &&
                        (search == null || product.str("name")!!.lowercase().contains(search))
                }
                200 to """{"items":${JsonArray(items)},"categoryCounts":[{"categoryId":"c1","count":2},{"categoryId":"c2","count":1}],
                    "priceRange":{"minDollars":18,"maxDollars":120}}"""
            }
            "GET" to "storefront/categories" -> 200 to """{"items":[{"id":"c1","name":"Shoes"},{"id":"c2","name":"Socks"}]}"""
            "GET" to "sites/site-1/marketing/bundle" ->
                200 to """{"reviews":{"rating":4.6,"totalCount":14,"counts":[{"rating":5,"count":8},{"rating":4,"count":6}],"items":[]}}"""
            "GET" to "storefront/products/p1" -> 200 to """
                {"id":"p1","name":"Trail Runner","description":"Grippy and light.","category":{"name":"Shoes"},"productImages":[],
                 "variants":[{"id":"v1","name":"Onyx","price":120}],
                 "crossVariantTitles":[{"id":"t1","title":"Size","variantId":null}],
                 "crossVariants":[{"id":"o2","crossVariantTitleId":"t1","value":"M","price":120},
                                  {"id":"o1","crossVariantTitleId":"t1","value":"S","price":120}],
                 "specifications":{"features":["Rock plate"],"groups":[{"name":"Fit","rows":[{"label":"Drop","value":"8 mm"}]}]}}"""
            "GET" to "storefront/products/p1/related" -> 200 to """{"items":[{"id":"p2","name":"Road Racer","minPriceDollars":99}]}"""
            "GET" to "storefront/products/p1/reviews" ->
                200 to """{"items":[{"id":"pr1","rating":5,"title":"Great grip","body":"Held on wet rock.","reviewerName":"Sam"}],"avgRating":5,"totalCount":1}"""
            "GET" to "storefront/products/p1/addons" -> 200 to """{"items":[]}"""
            "GET" to "cart" -> 200 to cartJson()
            "POST" to "cart/items" -> {
                val quantity = body!!["quantity"]!!.jsonPrimitive.int
                val size = (body["options"] as? JsonObject)?.str("Size")
                cart += buildJsonObject {
                    put("id", "line${cart.size + 1}")
                    put("productId", body.str("productId"))
                    put("variantId", body.str("variantId"))
                    put("productName", "Trail Runner")
                    put("variantTitle", listOfNotNull("Onyx", size?.let { "Size $it" }).joinToString(" · "))
                    put("quantity", quantity)
                    put("unitPrice", 120)
                    put("subtotal", 120 * quantity)
                }
                200 to cartJson()
            }
            "POST" to "cart/coupon" ->
                if (body?.str("code") == "RUN10") {
                    coupon = "RUN10"
                    200 to cartJson()
                } else {
                    400 to """{"message":"That code has expired."}"""
                }
            "GET" to "blog/categories" -> 200 to """{"items":[]}"""
            "GET" to "blog/tags" -> 200 to """{"items":["gear","training"]}"""
            "GET" to "blog/posts" -> 200 to """
                {"items":[
                  {"id":"b1","slug":"first-run","title":"Your first run","excerpt":"Start slow.","tags":["training"],"publishedAt":"2026-11-10T00:00:00Z"},
                  {"id":"b2","slug":"shoe-guide","title":"Choosing a shoe","isPinned":true,"tags":["gear"],"publishedAt":"2026-11-01T00:00:00Z"}],
                 "nextCursor":null}"""
            "GET" to "blog/posts/shoe-guide" -> 200 to """
                {"post":{"id":"b2","slug":"shoe-guide","title":"Choosing a shoe",
                  "content":"<h2>Fit first</h2><p>Try them <strong>late</strong> in the day.</p><script>alert(1)</script>",
                  "tags":["gear"],"likes":3,"ctaLabel":"Book a fitting","ctaHref":"https://example.com/fit"},
                 "access":"public"}"""
            "GET" to "blog/posts/shoe-guide/like" -> 200 to """{"liked":$liked,"likesCount":$likes}"""
            "POST" to "blog/posts/shoe-guide/like" -> {
                liked = !liked
                likes += if (liked) 1 else -1
                200 to """{"liked":$liked,"likesCount":$likes}"""
            }
            "GET" to "blog/posts/shoe-guide/comments" -> 200 to """{"items":${JsonArray(comments.toList())}}"""
            "POST" to "blog/posts/shoe-guide/comments" -> {
                comments += buildJsonObject {
                    put("id", "k${comments.size}")
                    put("content", body!!.str("content"))
                    put("authorName", "Ada")
                }
                200 to """{"comment":${comments.last()},"moderation":{"status":"approved","isApproved":true}}"""
            }
            "GET" to "reviews" -> {
                val source = sent.query["source"]
                val offset = sent.query["offset"]?.toInt() ?: 0
                val limit = sent.query["limit"]?.toInt() ?: 10
                val matched = REVIEWS.filter { source == null || it.str("source") == source }
                val end = (offset + limit).coerceAtMost(matched.size)
                200 to """{"items":${JsonArray(matched.subList(offset, end))},"nextOffset":${if (end < matched.size) end else null},
                    "totalCount":${matched.size}}"""
            }
            "POST" to "customer-portal/reviews" -> {
                review = body
                200 to """{"id":"new","status":"pending"}"""
            }
            else -> 404 to """{"message":"No route for ${sent.method.value} ${sent.path}"}"""
        }
    }

    companion object {
        val PRODUCTS: List<JsonObject> = Json.parseToJsonElement(
            """[
              {"id":"p1","name":"Trail Runner","categoryId":"c1","cheapestPriceCents":12000,"hasMultipleVariants":true,"isNew":true,"avgRating":4.5,"reviewCount":2},
              {"id":"p2","name":"Road Racer","categoryId":"c1","cheapestPriceCents":9900,"isOnSale":true,"comparePriceCents":11900},
              {"id":"p3","name":"Wool Socks","categoryId":"c2","cheapestPriceCents":1800}]""",
        ).let { array -> (array as JsonArray).map { it.jsonObject } }

        val REVIEWS: List<JsonObject> = (0 until 14).map { i ->
            buildJsonObject {
                put("id", "r$i")
                put("source", if (i % 2 == 0) "google" else "yelp")
                put("rating", if (i < 8) 5 else 4)
                put("text", "Review number $i")
                put("reviewUrl", if (i == 0) "javascript:alert(1)" else "https://example.com/r/$i")
                put("reviewerName", "Customer $i")
                put("timeCreated", "2026-11-20T12:00:00Z")
                put("verified", i < 3)
            }
        }
    }
}

private fun JsonObject.str(key: String): String? = (this[key] as? JsonPrimitive)?.takeIf { it.isString }?.content

/**
 * The app's screens, run on the JVM by Robolectric against [FakeBd]. A tall
 * screen keeps whole lists composed where a test counts their rows.
 */
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h4000dp")
class ShopBlogReviewsTest {
    @get:Rule val compose = createComposeRule()

    private val bd = FakeBd()
    private val prefs = RuntimeEnvironment.getApplication().getSharedPreferences("bd-shop-test", Context.MODE_PRIVATE)
    private val state = AppState(bd.client, "visitor-1", prefs, returnScheme = "app.bdstarter")

    private fun start() {
        compose.setContent {
            MaterialTheme { StarterApp(state) { Text("Account") } }
        }
    }

    private fun SemanticsNodeInteractionsProvider.waitForText(text: String, substring: Boolean = false) =
        compose.waitUntil(5_000) { onAllNodesWithText(text, substring).fetchSemanticsNodes().isNotEmpty() }

    private fun waitForLabel(label: String) =
        compose.waitUntil(5_000) { compose.onAllNodesWithContentDescription(label).fetchSemanticsNodes().isNotEmpty() }

    private fun gone(text: String) = compose.onAllNodesWithText(text).fetchSemanticsNodes().isEmpty()

    private fun tap(text: String) {
        compose.waitForText(text)
        compose.onAllNodesWithText(text)[0].performClick()
        compose.waitForIdle()
    }

    private fun top(text: String): Float = compose.onNodeWithText(text).fetchSemanticsNode().boundsInRoot.top

    @Test
    fun `the store - rating, categories with counts, and a category filter`() {
        start()
        compose.waitForText("3 products")
        waitForLabel("Rated 4.6 from 14 reviews. See all reviews.")
        compose.onNodeWithText("Shoes 2").assertExists()
        compose.onNodeWithText("From \$120.00").assertExists()
        compose.onNodeWithText("New").assertExists()
        tap("Socks 1")
        compose.waitForText("1 product")
        compose.onNodeWithText("Wool Socks").assertExists()
        assertTrue(gone("Trail Runner"))
        assertEquals("c2", bd.requests.last { it.path == "storefront/products" }.query["categoryId"])
    }

    @Test
    fun `a product - choose a size, add to cart, the badge counts it`() {
        start()
        tap("Trail Runner")
        compose.waitForText("Choose options")
        compose.onNodeWithText("Rock plate").assertExists()
        compose.onNodeWithText("8 mm").assertExists()
        compose.waitForText("Great grip")
        compose.waitForText("You may also like")
        // Sizes go smallest first.
        assertTrue(compose.onNodeWithText("S").fetchSemanticsNode().boundsInRoot.left < compose.onNodeWithText("M").fetchSemanticsNode().boundsInRoot.left)
        tap("M")
        compose.onNodeWithText("Size: M").assertExists()
        tap("Add to cart")
        compose.waitForText("View cart")
        val added = bd.requests.last { it.path == "cart/items" }.body
        assertEquals(Json.parseToJsonElement("""{"productId":"p1","quantity":1,"variantId":"v1","options":{"Size":"M"}}"""), added)
        assertEquals(1, state.cartCount)
        assertEquals("p1", state.recentlyViewed.items.single().id)
        // "View cart" goes back to the tabs, on Cart.
        tap("View cart")
        compose.waitForText("Onyx · Size M")
        assertEquals(Tab.Cart, state.tab)
        assertTrue(state.stack.isEmpty())
    }

    @Test
    fun `the cart - a bad coupon says why, and a good one applies`() {
        bd.cart += buildJsonObject {
            put("id", "line1")
            put("productName", "Trail Runner")
            put("variantTitle", "Onyx")
            put("quantity", 2)
            put("unitPrice", 120)
            put("subtotal", 240)
        }
        state.showTab(Tab.Cart)
        start()
        compose.waitForText("\$240.00")
        compose.onNodeWithContentDescription("Coupon code").performTextInput("OLD5")
        tap("Apply")
        compose.waitForText("That code has expired.")
        compose.onNodeWithContentDescription("Coupon code").performTextReplacement("RUN10")
        tap("Apply")
        compose.waitForText("Coupon RUN10 applied")
        assertEquals("visitor-1", bd.requests.last { it.path == "cart/coupon" }.headers["X-BD-Cart-Visitor"])
    }

    @Test
    fun `the blog - pinned first, a tag filter, and a post to like and comment on`() {
        state.showTab(Tab.Blog)
        start()
        compose.waitForText("Your first run")
        assertTrue(top("Choosing a shoe") < top("Your first run"))
        compose.onNodeWithText("Pinned").assertExists()
        tap("#training")
        compose.waitUntil(5_000) { gone("Choosing a shoe") }
        compose.onNodeWithText("Your first run").assertExists()
        tap("#training")
        tap("Choosing a shoe")
        compose.waitForText("Fit first")
        assertTrue(compose.onAllNodesWithText("alert", substring = true).fetchSemanticsNodes().isEmpty())
        compose.onNodeWithText("Book a fitting").assertExists()
        compose.onNodeWithText("Sign in to like").assertExists()
        compose.onNodeWithText("Sign in to comment").assertExists()
        // Signing in (on the Account tab) reloads the post as the customer.
        state.sessionToken = "tok-1"
        tap("Like")
        compose.waitForText("4 likes")
        assertEquals("tok-1", bd.requests.last { it.method == HttpMethod.Post && it.path.endsWith("/like") }.headers["X-BD-Session-Token"])
        compose.onNodeWithContentDescription("Add a comment").performTextInput("Size up for trails.")
        tap("Post comment")
        compose.waitForText("Comment posted.")
        compose.waitForText("Size up for trails.")
        compose.onNodeWithText("Comments (1)").assertExists()
    }

    @Test
    fun `reviews - the summary, more, a platform filter, and writing one`() {
        start()
        waitForLabel("Rated 4.6 from 14 reviews. See all reviews.")
        compose.onNodeWithContentDescription("Rated 4.6 from 14 reviews. See all reviews.").performClick()
        compose.waitForText("Review number 9")
        compose.onNodeWithText("14 reviews").assertExists()
        compose.onNodeWithContentDescription("5 stars: 8").assertExists()
        compose.onNodeWithText("Sign in to write a review").assertExists()
        assertEquals(3, compose.onAllNodesWithText("Verified").fetchSemanticsNodes().size)
        // Review 0's link isn't a web address, so it has none.
        assertEquals(4, compose.onAllNodesWithText("Read on Google").fetchSemanticsNodes().size)
        assertEquals(5, compose.onAllNodesWithText("Read on Yelp").fetchSemanticsNodes().size)
        tap("Show more")
        compose.waitForText("Review number 13")
        assertTrue(gone("Show more"))
        tap("Yelp")
        compose.waitUntil(5_000) { gone("Review number 2") }
        compose.waitForText("Review number 1")
        assertEquals("yelp", bd.requests.last { it.path == "reviews" }.query["source"])

        state.sessionToken = "tok-1"
        tap("Write a review")
        tap("Send review")
        compose.waitForText("Choose a rating from 1 to 5 stars.")
        compose.onNodeWithContentDescription("4 stars").performClick()
        compose.onNodeWithText("Your review").performTextInput("  Friendly and quick.  ")
        tap("Send review")
        compose.waitForText(Reviews.SENT)
        assertEquals(Json.parseToJsonElement("""{"rating":4,"body":"Friendly and quick."}"""), bd.review)
        assertEquals("tok-1", bd.requests.last { it.path == "customer-portal/reviews" }.headers["X-BD-Session-Token"])
    }

    @Test
    fun `saved lists - compare holds four, and the lists outlast a relaunch`() {
        val first = AppState(null, "v", prefs, "app.bdstarter")
        for (i in 0 until 5) first.compare.toggle(SavedProduct("p$i", "Product $i", null, null))
        first.wishlist.toggle(SavedProduct("p1", "Product 1", null, 1200))
        assertEquals(listOf("p0", "p1", "p2", "p3"), first.compare.items.map { it.id })

        val relaunched = AppState(null, "v", prefs, "app.bdstarter")
        assertEquals(4, relaunched.compare.items.size)
        assertEquals(1200, relaunched.wishlist.items.single().priceCents)
        relaunched.wishlist.toggle(SavedProduct("p1", "Product 1", null, null))
        assertTrue(relaunched.wishlist.items.isEmpty())
    }

    @Test
    fun `Stripe's return link shows the order, or the cart when the customer turned back`() {
        state.open(Route.Product("p1"))
        assertTrue(state.checkoutReturned("app.bdstarter://checkout/success?session_id=cs_test_1"))
        assertEquals(Tab.Cart, state.tab)
        assertEquals(Route.Order("cs_test_1"), state.stack.single().route)

        assertTrue(state.checkoutReturned("app.bdstarter://checkout/cancel"))
        assertTrue(state.stack.isEmpty())
        assertFalse(state.checkoutReturned("https://example.com/checkout/success?session_id=x"))
    }
}
