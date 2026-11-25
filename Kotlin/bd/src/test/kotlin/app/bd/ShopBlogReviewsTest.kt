package app.bd

import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.HttpRequestData
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.TextContent
import io.ktor.http.headersOf
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Answers every request with [body] and keeps the requests. */
private class Recorder(body: String) {
    val requests = mutableListOf<HttpRequestData>()

    val client = BdClient(
        host = "https://businessdash.us",
        publishableKey = "pk_test",
        siteId = "site-123",
        engine = MockEngine { request ->
            requests += request
            respond(body, HttpStatusCode.OK, headersOf(HttpHeaders.ContentType, "application/json"))
        },
    )

    val request: HttpRequestData get() = requests.single()
    val sent: JsonElement get() = Json.parseToJsonElement((request.body as TextContent).text)
}

private fun json(text: String): JsonElement = Json.parseToJsonElement(text)

class PostHtmlTest {
    /**
     * Post HTML in, and what the web starters' `safePostHtml` gives back;
     * every BD starter checks its port against the same cases.
     */
    @Test
    fun `cleans the same as every other starter`() {
        val text = PostHtmlTest::class.java.getResource("/post-html-parity.json")!!.readText()
        val cases = json(text).jsonObject["cases"]!!.jsonArray
        assertTrue(cases.size >= 20)
        for (case in cases) {
            val input = case.jsonObject["input"]!!.jsonPrimitive.content
            assertEquals(case.jsonObject["output"]!!.jsonPrimitive.content, PostHtml.safe(input), input)
        }
    }

    @Test
    fun `a long unclosed tag is text, not a stack overflow`() {
        val hostile = "<a " + "\"x\" ".repeat(50_000)
        assertTrue(PostHtml.safe(hostile).startsWith("&lt;a "))
    }

    @Test
    fun `reads as blocks, with scripts and unsafe links gone`() {
        val blocks = PostBlocks.from(
            """
            <h2>Weeks 1 to 3</h2><p>Run <strong>easy</strong> &amp; <a href="https://example.com/x">read this</a>
            <a href="javascript:alert(1)">bad</a> <a href="/store">ours</a></p>
            <script>alert(1)</script>
            <ul><li>Monday<ul><li>20 min</li></ul>then rest</li><li>Friday</li></ul>
            <ol start="3"><li>Third</li></ol>
            <img src="https://img.example/a.jpg" alt="Shoe"><img src="/local.jpg">
            <blockquote>Easy means talking.</blockquote><pre>let x = 1</pre><hr>
            """,
        )
        assertEquals(8, blocks.size)
        val heading = assertIs<PostBlock.Heading>(blocks[0])
        assertEquals(2, heading.level)
        assertEquals("Weeks 1 to 3", heading.text.plainText())
        val body = assertIs<PostBlock.Paragraph>(blocks[1]).text
        assertEquals("Run easy & read this bad ours", body.plainText())
        assertEquals(listOf("https://example.com/x"), body.mapNotNull { it.link })
        assertTrue(body.any { it.bold && it.text == "easy" })
        val list = assertIs<PostBlock.ItemList>(blocks[2]).items
        assertEquals(listOf("•", "◦", "", "•"), list.map { it.marker })
        assertEquals(listOf("Monday", "20 min", "then rest", "Friday"), list.map { it.text.plainText() })
        assertEquals(listOf(0, 1, 0, 0), list.map { it.depth })
        assertEquals("3.", assertIs<PostBlock.ItemList>(blocks[3]).items.first().marker)
        assertEquals(PostBlock.Image("https://img.example/a.jpg", "Shoe"), blocks[4])
        assertIs<PostBlock.Quote>(blocks[5])
        assertEquals(PostBlock.Code("let x = 1"), blocks[6])
        assertEquals(PostBlock.Rule, blocks[7])
    }

    @Test
    fun `keeps tables, captions, phone and mail links`() {
        val blocks = PostBlocks.from(
            "<figure><img src=\"https://img.example/b.jpg\" alt=\"\"><figcaption>Our <em>shop</em></figcaption></figure>" +
                "<table><thead><tr><th>Size</th><th>Drop</th></tr></thead><tbody><tr><td>S</td><td>8 mm</td></tr></tbody></table>" +
                "<p><a href=\"tel:+15551234567\">Call</a> or <a href=\"mailto:hi@example.com\">write</a></p>",
        )
        assertEquals(
            listOf(PostBlock.Image::class, PostBlock.Caption::class, PostBlock.Table::class, PostBlock.Paragraph::class),
            blocks.map { it::class },
        )
        val rows = (blocks[2] as PostBlock.Table).rows
        assertEquals(listOf(true, false), rows.map { it.isHeader })
        assertEquals(listOf(listOf("Size", "Drop"), listOf("S", "8 mm")), rows.map { row -> row.cells.map { it.plainText() } })
        assertEquals(
            listOf("tel:+15551234567", "mailto:hi@example.com"),
            (blocks[3] as PostBlock.Paragraph).text.mapNotNull { it.link },
        )
    }

    @Test
    fun `times and dates a post`() {
        assertEquals(3, PostHtml.readingMinutes("<p>${"word ".repeat(700)}</p>"))
        assertEquals("November 18, 2026", PostHtml.date("2026-11-18T15:00:00.000Z"))
        assertEquals("", PostHtml.date("not a date"))
    }
}

class ProductPageTest {
    private val shoe = ProductView.from(
        json(
            """
            {"id":"p1","name":"Trainer","category":{"name":"Shoes"},
             "productImages":[{"url":"b.jpg","order":2},{"url":"a.jpg","order":1}],
             "variants":[{"id":"v1","name":"Blue","price":120,"stock":0},{"id":"v2","name":"Black","price":120}],
             "variantImages":[{"variantId":"v2","url":"black.jpg","order":1}],
             "crossVariantTitles":[{"id":"t1","title":"Size","variantId":null}],
             "crossVariants":[
               {"id":"o3","crossVariantTitleId":"t1","value":"L","price":125,"stock":3},
               {"id":"o1","crossVariantTitleId":"t1","value":"S","price":120},
               {"id":"o2","crossVariantTitleId":"t1","value":"M","price":120,"isLive":false}],
             "specifications":{"features":["Light"],"groups":[{"name":"Fit","rows":[{"label":"Drop","value":"8 mm"},{"label":"","value":"x"}]}]}}
            """,
        ).jsonObject,
    )

    @Test
    fun `opens on the first style that can be bought, with its own photos`() {
        assertEquals("v2", shoe.defaultVariant?.id)
        assertEquals(listOf("black.jpg"), shoe.gallery("v2"))
        assertEquals(listOf("a.jpg", "b.jpg"), shoe.gallery("v1"))
        assertEquals("Shoes", shoe.categoryName)
        assertEquals(listOf("Light"), shoe.features)
        assertEquals("Fit", shoe.specs.single().name)
        assertEquals(listOf(SpecRow("Drop", "8 mm")), shoe.specs.single().rows)
    }

    @Test
    fun `sizes go smallest first, and the price is 'from' until every group is chosen`() {
        assertEquals(listOf("S", "M", "L"), shoe.optionGroups("v2").first().values.map { it.value })
        assertEquals(ProductPrice(amount = 120.0, from = true, ready = false), shoe.price("v2", emptyMap()))
        assertEquals(ProductPrice(amount = 125.0, from = false, stock = 3, ready = true), shoe.price("v2", mapOf("t1" to "o3")))
        assertEquals(mapOf("Size" to "L"), shoe.chosenOptions("v2", mapOf("t1" to "o3")))
        assertFalse(shoe.price("v2", mapOf("t1" to "o2")).ready)
        assertNull(shoe.price("v1", emptyMap()).amount)
    }
}

class ReviewRulesTest {
    private fun review(source: String, url: String) =
        Review(id = "r", rating = 5.0, source = source, reviewUrl = url)

    @Test
    fun `summarizes from the bundle counts`() {
        val summary = Reviews.summarize(
            ReviewTotals(
                rating = 4.1,
                totalCount = 14,
                counts = listOf(StarCount(5, 8), StarCount(4, 3), StarCount(3, 1), StarCount(2, 1), StarCount(1, 1)),
            ),
        )
        assertEquals(4.1, summary.average)
        assertEquals(14, summary.total)
        assertEquals(listOf(8, 3, 1, 1, 1), summary.histogram.map { it.count })
        assertEquals(8.0 / 14, summary.histogram.first().share, 1e-9)
    }

    @Test
    fun `links out over http(s) only, and only for a platform`() {
        assertNull(Reviews.link(review("google", "javascript:alert(1)")))
        assertNull(Reviews.link(review("other", "https://example.com/r")))
        assertNull(Reviews.link(review("google", "https://")))
        assertEquals("https://yelp.com/r/1", Reviews.link(review("yelp", "https://yelp.com/r/1")))
        assertEquals(listOf("yelp", "google"), Reviews.sourcesIn(listOf(review("yelp", ""), review("google", ""), review("yelp", ""))))
    }

    @Test
    fun `a review needs stars and words, and its title is cut at 200`() {
        assertEquals("Choose a rating from 1 to 5 stars.", Reviews.check(rating = 0, body = "Great").error)
        assertFalse(Reviews.check(rating = 5, body = "  ").isOk)
        assertFalse(Reviews.check(rating = 5, body = "x".repeat(5001)).isOk)
        assertEquals(200, Reviews.check(rating = 5, title = "x".repeat(250), body = "Great").review?.title?.length)
        assertEquals(ReviewInput(4, null, "Great"), Reviews.check(rating = 4, body = "Great").review)
    }

    @Test
    fun `stars, names and dates`() {
        assertEquals("★★★★☆", Reviews.stars(4.4))
        assertEquals("P", Reviews.reviewerInitial(Review(id = "r", reviewerName = " priya")))
        assertEquals("Anonymous", Reviews.reviewerName(Review(id = "r")))
        assertEquals("Nov 20, 2026", Reviews.date("2026-11-20T23:30:00Z"))
    }
}

class ShopRequestsTest {
    @Test
    fun `the grid carries category counts by categoryId and the price range in dollars`() = runTest {
        val stub = Recorder(
            """
            {"items":[{"id":"p1","name":"Trainer","isNew":true,"hasMultipleVariants":true,"cheapestPriceCents":12000}],
             "categoryCounts":[{"categoryId":"c1","count":2}],
             "priceRange":{"minDollars":18,"maxDollars":125}}
            """,
        )
        val grid = stub.client.productListing(search = "trail", minPriceCents = 2000, minRating = 4)
        assertEquals(mapOf("c1" to 2), grid.categoryCounts)
        assertEquals(125.0, grid.priceRange?.maxDollars)
        assertEquals(true, grid.items.single().isNew)
        val query = stub.request.url.parameters
        assertEquals("1", query["meta"])
        assertEquals("2000", query["minPriceCents"])
        assertEquals("4", query["minRating"])
        assertFalse(query.contains("maxPriceCents"))
    }

    @Test
    fun `a cart line is productName, variantTitle and productImage, and options go out`() = runTest {
        val stub = Recorder(
            """
            {"items":[{"id":"l1","productName":"Trainer","variantTitle":"Onyx · Size 42","productImage":"a.jpg","quantity":2,"subtotal":240}],
             "subtotal":240,"itemCount":2}
            """,
        )
        val cart = stub.client.cartAdd("v-1", productId = "p1", variantId = "v2", options = mapOf("Size" to "42"))
        assertEquals("Trainer", cart.items.single().name)
        assertEquals("Onyx · Size 42", cart.items.single().variantTitle)
        assertEquals(2, cart.units)
        assertEquals(json("""{"productId":"p1","quantity":1,"variantId":"v2","options":{"Size":"42"}}"""), stub.sent)
        assertEquals("v-1", stub.request.headers["X-BD-Cart-Visitor"])
    }

    @Test
    fun `an add-on goes in as its first variant, whose id is variantId`() {
        val addons = Json { ignoreUnknownKeys = true }.decodeFromString<ProductAddonList>(
            """{"items":[{"id":"a1","addonProductId":"p2","addonName":"Socks","priceCents":1800,
                "variants":[{"variantId":"v9","priceCents":1800}]}]}""",
        )
        assertEquals("v9", addons.items.single().firstVariantId)
        assertEquals("Socks", addons.items.single().name)
    }

    @Test
    fun `a coupon goes out as code`() = runTest {
        val stub = Recorder("""{"items":[],"couponCode":"RUN10"}""")
        assertEquals("RUN10", stub.client.cartApplyCoupon("v-1", "RUN10").couponCode)
        assertEquals(json("""{"code":"RUN10"}"""), stub.sent)
        assertTrue(stub.request.url.encodedPath.endsWith("/cart/coupon"))
    }
}

class BlogAndReviewRequestsTest {
    @Test
    fun `likes and comments send the session as X-BD-Session-Token`() = runTest {
        val stub = Recorder("""{"liked":true,"likesCount":3}""")
        val likes = stub.client.togglePostLike("a b", sessionToken = "tok")
        assertTrue(likes.liked)
        assertEquals(3, likes.count)
        assertEquals("tok", stub.request.headers["X-BD-Session-Token"])
        assertTrue(stub.request.url.encodedPath.endsWith("blog/posts/a%20b/like"))
    }

    @Test
    fun `a post arrives wrapped, and a members-only one says so`() = runTest {
        val stub = Recorder(
            """{"post":{"id":"b1","slug":"plan","title":"Plan","content":"","isPinned":true,"tags":["training"]},"access":"paywall"}""",
        )
        val detail = stub.client.blogPost("plan")
        assertTrue(detail.isPaywalled)
        assertTrue(detail.post.isPinned)
        assertEquals(listOf("training"), detail.post.tags)
        assertNull(stub.request.headers["X-BD-Session-Token"])
    }

    @Test
    fun `a held comment says so`() = runTest {
        val stub = Recorder("""{"comment":{"id":"c1"},"moderation":{"isApproved":false}}""")
        assertFalse(stub.client.postComment("plan", "Nice", sessionToken = "tok").isApproved)
        assertEquals(json("""{"content":"Nice"}"""), stub.sent)
    }

    @Test
    fun `review pages filter by platform, and a written review goes to the portal`() = runTest {
        val stub = Recorder(
            """{"items":[{"id":"r1","rating":5,"source":"yelp","text":"Great","photos":["p.jpg"],"timeCreated":"2026-11-20T00:00:00Z"}],
                "nextOffset":10,"totalCount":14}""",
        )
        val page = stub.client.reviewPage(source = "yelp")
        assertEquals(10, page.nextOffset)
        assertEquals(listOf("p.jpg"), page.items.single().photos)
        assertEquals("yelp", stub.request.url.parameters["source"])

        val portal = Recorder("""{"id":"r9","status":"pending"}""")
        portal.client.portal("tok").submitReview(ReviewInput(rating = 4, body = "Good"))
        assertTrue(portal.request.url.encodedPath.endsWith("customer-portal/reviews"))
        assertEquals("tok", portal.request.headers["X-BD-Session-Token"])
        assertEquals(json("""{"rating":4,"body":"Good"}"""), portal.sent)
    }

    @Test
    fun `the summary's totals come from the home page bundle`() = runTest {
        val stub = Recorder("""{"reviews":{"rating":4.1,"totalCount":14,"counts":[{"rating":5,"count":8}]}}""")
        val totals = stub.client.reviewTotals()
        assertEquals(14, totals?.totalCount)
        assertEquals(listOf(StarCount(5, 8)), totals?.counts)
        assertTrue(stub.request.url.encodedPath.endsWith("sites/site-123/marketing/bundle"))
        assertEquals("home", stub.request.url.parameters["pageKey"])
    }

    @Test
    fun `product reviews have a title and a body`() = runTest {
        val stub = Recorder(
            """{"items":[{"id":"r1","rating":4,"title":"Comfy","content":"Wore them all week","reviewerName":"Sam"}],
                "avgRating":4.5,"totalCount":2}""",
        )
        val page = stub.client.productReviews("p1")
        assertEquals("Wore them all week", page.items.single().body)
        assertEquals(2, page.totalCount)
    }
}
