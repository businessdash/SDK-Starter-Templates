import Foundation
import Testing

@testable import BusinessDashKit

private func client(_ json: String, recorder: StubTransport.Recorder? = nil) -> BdClient {
    BdClient(
        host: URL(string: "https://www.businessdash.us")!,
        publishableKey: "pk_test",
        siteID: "site-123",
        transport: StubTransport(json: json, recorder: recorder)
    )
}

private func view(_ json: String) throws -> ProductView {
    ProductView(try JSONDecoder.bd.decode(JSONValue.self, from: Data(json.utf8)))
}

@Suite("Post HTML")
struct PostHtmlTests {
    struct Fixture: Decodable {
        struct Case: Decodable, CustomTestStringConvertible {
            let input: String
            let output: String
            var testDescription: String { input.debugDescription }
        }
        let cases: [Case]
    }

    /// The TypeScript's answers (the same file the server starters replay).
    static let cases: [Fixture.Case] = {
        let url = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .appendingPathComponent("Fixtures/post-html-parity.json")
        guard let data = try? Data(contentsOf: url),
              let fixture = try? JSONDecoder().decode(Fixture.self, from: data) else { return [] }
        return fixture.cases
    }()

    @Test func fixtureLoads() {
        #expect(Self.cases.count >= 20)
    }

    @Test("safe() gives what safePostHtml gives", arguments: cases)
    func matchesTypeScript(_ testCase: Fixture.Case) {
        #expect(PostHtml.safe(testCase.input) == testCase.output)
    }

    @Test("A post reads as blocks, with scripts and unsafe links gone")
    func blocks() {
        let blocks = PostBlocks.from("""
        <h2>Weeks 1 to 3</h2><p>Run <strong>easy</strong> &amp; <a href="https://example.com/x">read this</a>
        <a href="javascript:alert(1)">bad</a> <a href="/store">ours</a></p>
        <script>alert(1)</script>
        <ul><li>Monday<ul><li>20 min</li></ul>then rest</li><li>Friday</li></ul>
        <ol start="3"><li>Third</li></ol>
        <img src="https://img.example/a.jpg" alt="Shoe"><img src="/local.jpg">
        <blockquote>Easy means talking.</blockquote><pre>let x = 1</pre><hr>
        """)

        guard case .heading(2, let title) = blocks[0] else { Issue.record("no heading"); return }
        #expect(String(title.characters) == "Weeks 1 to 3")

        guard case .paragraph(let body) = blocks[1] else { Issue.record("no paragraph"); return }
        #expect(String(body.characters) == "Run easy & read this bad ours")
        let links = body.runs.compactMap(\.link)
        #expect(links == [URL(string: "https://example.com/x")!])
        #expect(body.runs.contains { $0.inlinePresentationIntent == .stronglyEmphasized })

        guard case .list(let items) = blocks[2] else { Issue.record("no list"); return }
        #expect(items.map(\.marker) == ["•", "◦", "", "•"])
        #expect(items.map { String($0.text.characters) } == ["Monday", "20 min", "then rest", "Friday"])
        #expect(items.map(\.depth) == [0, 1, 0, 0])

        guard case .list(let numbered) = blocks[3] else { Issue.record("no numbered list"); return }
        #expect(numbered.first?.marker == "3.")

        #expect(blocks[4] == .image(url: URL(string: "https://img.example/a.jpg")!, alt: "Shoe"))
        guard case .quote = blocks[5] else { Issue.record("no quote"); return }
        #expect(blocks[6] == .code("let x = 1"))
        #expect(blocks[7] == .rule)
        #expect(blocks.count == 8)
    }

    @Test func readingTimeAndDate() {
        #expect(PostHtml.readingMinutes("<p>" + String(repeating: "word ", count: 700) + "</p>") == 3)
        #expect(PostHtml.date("2026-11-18T15:00:00.000Z") == "November 18, 2026")
    }
}

@Suite("Product page")
struct ProductViewTests {
    static let shoe = """
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
    """

    @Test("Opens on the first variant that can be bought, with its own photos")
    func defaultsAndGallery() throws {
        let product = try view(Self.shoe)
        #expect(product.defaultVariant?.id == "v2")
        #expect(product.gallery(for: "v2") == ["black.jpg"])
        #expect(product.gallery(for: "v1") == ["a.jpg", "b.jpg"])
        #expect(product.categoryName == "Shoes")
        #expect(product.specs == [SpecGroup(name: "Fit", rows: [.init(label: "Drop", value: "8 mm")])])
    }

    @Test("Sizes go smallest first; the price is 'from' until every group is chosen")
    func optionsAndPrice() throws {
        let product = try view(Self.shoe)
        #expect(product.optionGroups(for: "v2").first?.values.map(\.value) == ["S", "M", "L"])

        let open = product.price(variantID: "v2", chosen: [:])
        #expect(open == ProductPrice(amount: 120, from: true, stock: nil, ready: false))

        let large = product.price(variantID: "v2", chosen: ["t1": "o3"])
        #expect(large == ProductPrice(amount: 125, from: false, stock: 3, ready: true))
        #expect(product.chosenOptions(variantID: "v2", chosen: ["t1": "o3"]) == ["Size": "L"])

        #expect(product.price(variantID: "v2", chosen: ["t1": "o2"]).ready == false)
        #expect(product.price(variantID: "v1", chosen: [:]).amount == nil)
    }
}

@Suite("Shop and blog wire shapes")
struct ShopWireTests {
    @Test("The grid's category counts carry categoryId, and the price range is in dollars")
    func gridMeta() async throws {
        let grid = try await client(#"""
        {"items":[{"id":"p1","name":"Sock","cheapestPriceCents":1800,"isNew":true,"hasMultipleVariants":false}],
         "categoryCounts":[{"categoryId":"c1","count":4}],"priceRange":{"minDollars":18,"maxDollars":125},"nextCursor":null}
        """#).storefront.grid()
        #expect(grid.categoryCounts?.first?.categoryId == "c1")
        #expect(grid.priceRange?.maxDollars == 125)
        #expect(grid.items.first?.isNew == true)
    }

    @Test("Filters go out in cents")
    func gridFilters() async throws {
        let recorder = StubTransport.Recorder()
        _ = try await client(#"{"items":[]}"#, recorder: recorder).storefront
            .grid(minPriceCents: 2000, minRating: 4, sort: "price-asc")
        let url = try #require(recorder.request?.url?.absoluteString)
        #expect(url.contains("minPriceCents=2000"))
        #expect(url.contains("minRating=4"))
        #expect(!url.contains("maxPriceCents"))
    }

    @Test("An add-on goes in as its first variant, whose id is variantId")
    func addonVariant() throws {
        let json = #"{"id":"a1","addonProductId":"p2","addonName":"Socks","variants":[{"variantId":"v9","priceCents":1800}]}"#
        let addon = try JSONDecoder.bd.decode(StoreAddon.self, from: Data(json.utf8))
        #expect(addon.firstVariantID == "v9")
    }

    @Test("A cart line is productName · variantTitle")
    func cartLine() async throws {
        let cart = try await client(#"""
        {"items":[{"id":"i1","productName":"Trainer","variantTitle":"Size 42","quantity":2,"unitPrice":120}],
         "subtotal":240,"currency":"usd","itemCount":2}
        """#).cart(visitorToken: "v").snapshot()
        #expect(cart.items.first?.title == "Trainer · Size 42")
        #expect(cart.units == 2)
    }

    @Test("Likes and comments send the session as X-BD-Session-Token")
    func sessionHeader() async throws {
        let recorder = StubTransport.Recorder()
        let likes = try await client(#"{"liked":true,"likesCount":3}"#, recorder: recorder).blog
            .toggleLike(slug: "a b", sessionToken: "tok")
        #expect(likes.liked)
        #expect(recorder.request?.value(forHTTPHeaderField: "X-BD-Session-Token") == "tok")
        #expect(recorder.request?.url?.path.hasSuffix("blog/posts/a%20b/like") == true)
    }
}
