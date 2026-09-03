import Foundation
import Testing

@testable import BusinessDashKit

/// A stub transport. This is what `BdTransport` exists for — the tests
/// exercise real decoding and real error mapping without a network or a
/// URLProtocol subclass.
struct StubTransport: BdTransport {
    let status: Int
    let json: String
    /// Captures the request so a test can assert on the URL that was built.
    let recorder: Recorder?

    final class Recorder: @unchecked Sendable {
        // Guarded by its own lock: the transport may be called from any
        // executor, and this is the "provably thread-safe with internal
        // locking" case rather than a way to silence the checker.
        private let lock = NSLock()
        private var _request: URLRequest?

        var request: URLRequest? {
            lock.lock()
            defer { lock.unlock() }
            return _request
        }

        func record(_ request: URLRequest) {
            lock.lock()
            _request = request
            lock.unlock()
        }
    }

    init(status: Int = 200, json: String, recorder: Recorder? = nil) {
        self.status = status
        self.json = json
        self.recorder = recorder
    }

    func send(_ request: URLRequest) async throws -> (Data, Int) {
        recorder?.record(request)
        return (Data(json.utf8), status)
    }
}

private func makeClient(_ transport: any BdTransport) -> BdClient {
    BdClient(
        host: URL(string: "https://www.biab.app")!,
        publishableKey: "pk_test",
        siteID: "site-123",
        transport: transport
    )
}

// MARK: - The access gate

@Suite("Access gate")
struct AccessGateTests {
    /// The subtle one. Reads signal a lapsed plan with **HTTP 200** and a body
    /// flag, so a client that only checks `statusCode` decodes an empty page
    /// and shows nothing. This test is the reason `BdClient` inspects the
    /// body before the status.
    @Test("A 200 carrying available:false throws rather than decoding")
    func gateOnSuccessfulStatus() async throws {
        let client = makeClient(
            StubTransport(
                status: 200,
                json: """
                {"available":false,"reason":"payment_required",
                 "message":"Billing lapsed.","upgradeUrl":"https://www.biab.app/billing"}
                """
            )
        )

        await #expect(throws: BdError.self) {
            _ = try await client.storefront.list()
        }

        do {
            _ = try await client.storefront.list()
            Issue.record("Expected the gate to throw.")
        } catch let error as BdError {
            guard case .accessRejected(let reason, let upgradeURL, _) = error else {
                Issue.record("Expected .accessRejected, got \(error)")
                return
            }
            #expect(reason == .paymentRequired)
            #expect(upgradeURL?.absoluteString == "https://www.biab.app/billing")
            #expect(error.isUnavailable)
        }
    }

    @Test("plan_required is not treated as 'temporarily unavailable'")
    func planRequiredIsNotUnavailable() {
        let error = BdError.accessRejected(reason: .planRequired, upgradeURL: nil, message: "")
        #expect(error.isUnavailable == false)
    }
}

// MARK: - Decoding

@Suite("Decoding")
struct DecodingTests {
    @Test("Checkout reads stripeUrl, not url")
    func checkoutFieldName() async throws {
        let client = makeClient(
            StubTransport(json: """
            {"sessionId":"cs_1","stripeUrl":"https://checkout.stripe.com/x",
             "totalAmountCents":2500,"currency":"USD"}
            """)
        )

        let session = try await client.cart(visitorToken: "v1")
            .startCheckout(CheckoutURLs(successURL: "a://ok", cancelURL: "a://no"))

        #expect(session.stripeURL?.host() == "checkout.stripe.com")
        #expect(session.totalAmountCents == 2500)
    }

    @Test("A new nullable field doesn't break decoding")
    func toleratesUnknownFields() async throws {
        let client = makeClient(
            StubTransport(json: """
            {"items":[{"id":"p1","name":"Widget","cheapestPriceCents":1999,
              "somethingAddedNextRelease":true}],"nextCursor":null}
            """)
        )

        let response = try await client.storefront.list()
        #expect(response.products.count == 1)
        #expect(response.products[0].cheapestPriceCents == 1999)
    }

    /// The platform keys EVERY list response `items` — not `products`,
    /// `posts`, or `reviews`. Getting this wrong decodes to an empty list
    /// rather than throwing, so a screen renders "no products" against a full
    /// catalog and nothing looks broken. Pinned here for that reason.
    @Test("List responses decode from `items`, not the plural of the thing")
    func listsAreKeyedItems() async throws {
        let client = makeClient(
            StubTransport(json: #"{"items":[{"id":"p1","name":"Widget"}],"nextCursor":null}"#)
        )
        let response = try await client.storefront.list()
        #expect(response.items.count == 1)
        #expect(response.products.count == 1)
    }

    /// The item fields are the platform's names, not the obvious ones: a
    /// product card carries `cheapestPriceCents` and `coverImage`, a review
    /// carries `text` and `reviewerName`, a chat message carries `content`.
    /// Each of these decodes to nil rather than throwing when guessed wrong,
    /// which is why they're pinned.
    @Test("Item fields use the platform's names, not the obvious ones")
    func itemFieldNames() async throws {
        let client = makeClient(StubTransport(json: #"""
        {"items":[{"id":"p1","name":"Widget","description":"d","coverImage":"http://i",
          "cheapestPriceCents":1999,"comparePriceCents":2999,"avgRating":4.5,"reviewCount":3,
          "isOnSale":true}]}
        """#))

        let card = try await client.storefront.grid().items[0]
        #expect(card.cheapestPriceCents == 1999)
        #expect(card.coverImage == "http://i")
        #expect(card.avgRating == 4.5)
    }

    @Test("A blog post arrives wrapped with its access level")
    func blogPostIsWrapped() async throws {
        let client = makeClient(
            StubTransport(json: #"{"post":{"id":"b1","slug":"s","title":"T"},"access":"paywall"}"#)
        )
        let detail = try await client.blog.post(slug: "s")
        #expect(detail.post.title == "T")
        #expect(detail.isPaywalled)
    }

    @Test("A relation decodes from a link object or a bare id")
    func relationShapes() throws {
        let json = """
        {"records":[
          {"id":"t1","fields":{"todo":{"id":"parent-1"}}},
          {"id":"t2","fields":{"todo":"parent-2"}},
          {"id":"t3","fields":{"todo":null}}
        ],"nextCursor":null}
        """

        let response = try JSONDecoder.bd.decode(
            DataModelRecordsResponse.self, from: Data(json.utf8)
        )

        #expect(response.records[0].relationID("todo") == "parent-1")
        #expect(response.records[1].relationID("todo") == "parent-2")
        #expect(response.records[2].relationID("todo") == nil)
    }
}

// MARK: - Request building

@Suite("Request building")
struct RequestTests {
    @Test("Nil query values are dropped, not sent as empty")
    func dropsNilQuery() async throws {
        let recorder = StubTransport.Recorder()
        let client = makeClient(
            StubTransport(json: #"{"items":[],"nextCursor":null}"#, recorder: recorder)
        )

        _ = try await client.storefront.grid(search: nil, categoryID: "cat-1", limit: 10)

        let url = try #require(recorder.request?.url?.absoluteString)
        #expect(url.contains("categoryId=cat-1"))
        #expect(url.contains("limit=10"))
        #expect(!url.contains("search"))
    }

    @Test("The bearer token and site path are applied")
    func authAndSitePath() async throws {
        let recorder = StubTransport.Recorder()
        let client = makeClient(StubTransport(json: "{}", recorder: recorder))

        _ = try? await client.marketing.pageBundle()

        let request = try #require(recorder.request)
        #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer pk_test")
        #expect(request.url?.path().contains("/sites/site-123/marketing/bundle") == true)
    }

    @Test("Portal and auth use different session headers")
    func sessionHeaderNames() async throws {
        // Not a style point — sending the wrong one reads as "not signed in"
        // rather than as an error, which is a slow bug to find.
        let recorder = StubTransport.Recorder()
        let client = makeClient(StubTransport(json: "{}", recorder: recorder))

        _ = try? await client.portal(sessionToken: "tok", organizationID: "org-1").context()
        #expect(recorder.request?.value(forHTTPHeaderField: "X-BD-Session-Token") == "tok")
        #expect(recorder.request?.value(forHTTPHeaderField: "X-BD-Customer-Portal-Org") == "org-1")

        _ = await BdAuth(client: client, callbackURL: "a://cb").session(token: "tok")
        #expect(recorder.request?.value(forHTTPHeaderField: "x-bd-session") == "tok")
    }
}

// MARK: - Money

@Suite("Money")
struct MoneyTests {
    /// The two shapes are a 100× error apart, which is why they are separate
    /// functions rather than one overloaded helper.
    @Test("cents divides by 100; amount does not")
    func centsVersusAmount() {
        #expect(Money.cents(1999).contains("19.99"))
        #expect(Money.amount(19.99).contains("19.99"))
        #expect(Money.cents(nil) == "")
        #expect(Money.amount(nil) == "")
    }
}

// MARK: - JSONValue

@Suite("Marketing bundle access")
struct JSONValueTests {
    private func bundle() throws -> JSONValue {
        let json = """
        {"sections":{"hero":{"headline":"Real headline","subhead":""},"about":{}}}
        """
        return try JSONDecoder.bd.decode(JSONValue.self, from: Data(json.utf8))
    }

    @Test("A key path reads through nested objects")
    func keyPath() throws {
        #expect(try bundle().string("sections", "hero", "headline") == "Real headline")
    }

    /// An author who cleared a field wants the local default back, not a blank
    /// heading — so an empty string reads as missing.
    @Test("An empty string is treated as missing")
    func emptyStringIsMissing() throws {
        #expect(try bundle().string("sections", "hero", "subhead") == nil)
    }

    @Test("A missing key path is nil, not a crash")
    func missingPath() throws {
        #expect(try bundle().string("sections", "nope", "headline") == nil)
        #expect(try bundle().string("sections", "about", "title") == nil)
    }
}
