package app.bd

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

    val client = BdClient(
        host = "https://www.businessdash.us",
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
             "message":"Billing lapsed.","upgradeUrl":"https://www.businessdash.us/billing"}
            """.trimIndent(),
        )

        val error = assertFailsWith<BdAccessRejectedException> { stub.client.products() }

        assertEquals(AccessRejectionReason.PAYMENT_REQUIRED, error.reason)
        assertEquals("https://www.businessdash.us/billing", error.upgradeUrl)
        assertTrue(error.isUnavailable)
    }

    @Test
    fun `plan_required is not treated as temporarily unavailable`() {
        val error = BdAccessRejectedException(AccessRejectionReason.PLAN_REQUIRED, null, "")
        assertFalse(error.isUnavailable)
    }

    @Test
    fun `a real 4xx still throws an http exception`() = runTest {
        val stub = Stub("""{"message":"Nope."}""", HttpStatusCode.NotFound)

        val error = assertFailsWith<BdHttpException> { stub.client.products() }
        assertEquals(404, error.status)
    }

    @Test
    fun `a secret key is refused at construction`() {
        assertFailsWith<IllegalArgumentException> {
            BdClient(host = "https://www.businessdash.us", publishableKey = "sk_live_x", siteId = "s")
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

        assertEquals("visitor-9", stub.requests.single().headers["X-BD-Cart-Visitor"])
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

class DonationsTest {
    /**
     * The platform's own `coverFeeCents` output, also pinned in the JS SDK —
     * a page must show the cents the checkout charges.
     */
    @Test
    fun `cover fees matches the platform to the cent`() {
        val reference = listOf(
            Triple(2500, 0, 106), Triple(5000, 0, 181), Triple(10000, 100, 438),
            Triple(1999, 0, 91), Triple(123456, 250, 7079), Triple(500, 0, 46),
        )
        for ((amount, platformBps, fee) in reference) {
            assertEquals(fee, donationCoverFeeCents(amount, 290 + platformBps, 30))
        }
        assertEquals(0, donationCoverFeeCents(0, 290, 30))
    }

    @Test
    fun `the giving page decodes including the tax statement`() = runTest {
        val stub = Stub(
            """
            {"orgName":"Gerus","avatarUrl":null,"accentColor":null,"title":"Support our work",
             "appeal":null,"presetAmountsCents":[2500,5000],"monthlyPresetAmountsCents":[1000],
             "allowOneTime":true,"allowMonthly":true,"defaultFrequency":"one_time",
             "minAmountCents":500,"maxAmountCents":2500000,"currency":"usd","offerCoverFees":true,
             "platformFeeBps":null,"coverFee":{"rateBps":290,"fixedCents":30},"thankYouMessage":null,
             "isTaxDeductible":false,
             "taxStatement":"Gerus is not a registered 501(c)(3) charity, so this gift is not tax-deductible.",
             "unavailable":null,"hostedUrl":"https://www.businessdash.us/give/gerus"}
            """.trimIndent(),
        )
        val page = stub.client.donationPage()
        assertTrue(page.isAcceptingGifts)
        assertFalse(page.isTaxDeductible)
        assertEquals(106, page.coverFeeCents(2500))
        assertTrue(stub.requests.single().url.encodedPath.endsWith("/donations"))
    }

    @Test
    fun `starting a gift posts to donations checkout`() = runTest {
        val stub = Stub(
            """
            {"url":"https://checkout.stripe.com/c/pay/cs_1","frequency":"monthly","amountCents":2500,
             "coveredFeeCents":106,"totalAmountCents":2606,"currency":"usd"}
            """.trimIndent(),
        )
        val checkout = stub.client.startDonationCheckout(
            DonationCheckoutInput(
                amountCents = 2500,
                frequency = "monthly",
                donor = DonationDonor("Ada", "ada@example.com"),
                coverFees = true,
            ),
        )
        assertEquals(2606, checkout.totalAmountCents)
        val request = stub.requests.single()
        assertEquals("POST", request.method.value)
        assertTrue(request.url.encodedPath.endsWith("/donations/checkout"))
    }
}

class DeleteAccountTest {
    @Test
    fun `delete account posts the auth session header and reads the answer`() = runTest {
        val stub = Stub("""{"deleted":true,"signInKept":false}""")
        val result = stub.client.deleteAccount("tok")
        assertEquals(AccountDeleted(deleted = true, signInKept = false), result)
        val request = stub.requests.single()
        assertEquals("POST", request.method.value)
        assertTrue(request.url.encodedPath.endsWith("/auth/customer/delete-account"))
        assertEquals("tok", request.headers["x-bd-session"])
    }
}
