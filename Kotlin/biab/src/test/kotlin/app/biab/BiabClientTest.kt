package app.biab

import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.HttpRequestData
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Ktor's `MockEngine` is the seam — no network and no local server, while the
 * real decoding and error mapping still run.
 */
private class Stub(body: String, status: HttpStatusCode = HttpStatusCode.OK) {
    val requests = mutableListOf<HttpRequestData>()

    val client = BiabClient(
        host = "https://www.biab.app",
        publishableKey = "pk_test",
        siteId = "site-123",
        engine = MockEngine { request ->
            requests += request
            respond(
                content = body,
                status = status,
                headers = headersOf(HttpHeaders.ContentType, "application/json"),
            )
        },
    )
}

class AccessGateTest {
    /**
     * The subtle one. Reads signal a lapsed plan with HTTP **200** and a body
     * flag, so a client that only checks the status code decodes an empty
     * screen and shows nothing. This pins the check order.
     */
    @Test
    fun `a 200 carrying available false throws rather than decoding`() = runTest {
        val stub = Stub(
            """
            {"available":false,"reason":"payment_required",
             "message":"Billing lapsed.","upgradeUrl":"https://www.biab.app/billing"}
            """.trimIndent(),
        )

        val error = assertFailsWith<BiabAccessRejectedException> { stub.client.products() }

        assertEquals(AccessRejectionReason.PAYMENT_REQUIRED, error.reason)
        assertEquals("https://www.biab.app/billing", error.upgradeUrl)
        assertTrue(error.isUnavailable)
    }

    @Test
    fun `plan_required is not treated as temporarily unavailable`() {
        val error = BiabAccessRejectedException(AccessRejectionReason.PLAN_REQUIRED, null, "")
        assertFalse(error.isUnavailable)
    }

    @Test
    fun `a real 4xx still throws an http exception`() = runTest {
        val stub = Stub("""{"message":"Nope."}""", HttpStatusCode.NotFound)

        val error = assertFailsWith<BiabHttpException> { stub.client.products() }
        assertEquals(404, error.status)
    }

    @Test
    fun `a secret key is refused at construction`() {
        assertFailsWith<IllegalArgumentException> {
            BiabClient(host = "https://www.biab.app", publishableKey = "sk_live_x", siteId = "s")
        }
    }
}

class DecodingTest {
    @Test
    fun `checkout reads stripeUrl not url`() = runTest {
        val stub = Stub("""{"stripeUrl":"https://checkout.stripe.com/x","sessionId":"cs_1"}""")

        val session = stub.client.startCheckout("visitor-1", "a://ok", "a://no")

        assertTrue(session.stripeUrl.contains("checkout.stripe.com"))
    }

    @Test
    fun `a new unknown field does not break decoding`() = runTest {
        val stub = Stub(
            """{"items":[{"id":"p1","name":"Widget","cheapestPriceCents":1999,
               "somethingAddedNextRelease":true}]}""",
        )

        val products = stub.client.products()

        assertEquals(1, products.size)
        assertEquals(1999, products.first().cheapestPriceCents)
    }
}

class RequestBuildingTest {
    @Test
    fun `null query values are dropped not sent as empty`() = runTest {
        val stub = Stub("""{"items":[]}""")

        stub.client.productGrid(search = null, sort = "newest")

        val url = stub.requests.single().url.toString()
        assertTrue(url.contains("sort=newest"))
        assertFalse(url.contains("search"))
    }

    /**
     * The platform keys EVERY list response `items` — not `products`,
     * `posts`, or `reviews`. Getting it wrong decodes to an empty list rather
     * than throwing, so a screen renders "no products" against a full catalog
     * and nothing looks broken. Pinned for that reason.
     */
    @Test
    fun `list responses decode from items not the plural of the thing`() = runTest {
        val stub = Stub("""{"items":[{"id":"p1","name":"Widget"}]}""")

        val products = stub.client.products()

        assertEquals(1, products.size)
        assertEquals("Widget", products.first().name)
    }

    @Test
    fun `the bearer token and site path are applied`() = runTest {
        val stub = Stub("""{"items":[]}""")

        stub.client.get<ProductListResponse>(stub.client.sitePath("marketing/bundle"))

        val request = stub.requests.single()
        assertEquals("Bearer pk_test", request.headers[HttpHeaders.Authorization])
        assertTrue(request.url.encodedPath.contains("/sites/site-123/marketing/bundle"))
    }

    @Test
    fun `the cart visitor header is applied`() = runTest {
        val stub = Stub("""{"items":[]}""")

        stub.client.cart("visitor-9")

        assertEquals("visitor-9", stub.requests.single().headers["X-BIAB-Cart-Visitor"])
    }
}

class MoneyTest {
    /**
     * The two shapes are a 100× error apart, which is why they are separate
     * functions rather than one overloaded helper.
     */
    @Test
    fun `cents divides by 100 and amount does not`() {
        assertEquals("$19.99", Money.cents(1999))
        assertEquals("$19.99", Money.amount(19.99))
        assertEquals("", Money.cents(null))
        assertEquals("", Money.amount(null))
    }

    @Test
    fun `an unknown currency falls back to a code prefix`() {
        assertEquals("JPY 19.99", Money.cents(1999, "JPY"))
    }
}

class BundleTest {
    private val bundle = parseBundle(
        """{"sections":{"hero":{"headline":"Real headline","subhead":""},"about":{}}}""",
    )

    @Test
    fun `a key path reads through nested objects`() {
        assertEquals("Real headline", bundle.string("sections", "hero", "headline"))
    }

    /**
     * An author who cleared a field wants the local default back, not a blank
     * heading — so an empty string reads as missing.
     */
    @Test
    fun `an empty string is treated as missing`() {
        assertNull(bundle.string("sections", "hero", "subhead"))
    }

    @Test
    fun `a missing key path is null not a crash`() {
        assertNull(bundle.string("sections", "nope", "headline"))
        assertNull(bundle.string("sections", "about", "title"))
    }
}
