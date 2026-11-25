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

@Suite("Business reviews")
struct BusinessReviewsTests {
    @Test("A page carries its total and where the next one starts; the source filter goes out")
    func listPage() async throws {
        let recorder = StubTransport.Recorder()
        let page = try await client(#"""
        {"items":[{"id":"r1","source":"yelp","rating":4,"text":"Good","reviewUrl":"https://www.yelp.com/x",
          "reviewerName":"Tom","reviewerImageUrl":null,"photos":["https://img/1.jpg"],
          "timeCreated":"2026-11-01T00:00:00.000Z","verified":true}],
         "totalCount":4,"nextOffset":1}
        """#, recorder: recorder).reviews.list(limit: 1, offset: 0, source: "yelp")
        #expect(page.totalCount == 4)
        #expect(page.nextOffset == 1)
        #expect(page.items.first?.photos == ["https://img/1.jpg"])
        #expect(page.items.first?.reviewUrl == "https://www.yelp.com/x")
        let url = try #require(recorder.request?.url?.absoluteString)
        #expect(url.contains("source=yelp"))
        #expect(url.contains("/reviews?") || url.contains("/reviews"))
    }

    @Test("Without a source, none goes out")
    func noSource() async throws {
        let recorder = StubTransport.Recorder()
        _ = try await client(#"{"items":[],"totalCount":0,"nextOffset":null}"#, recorder: recorder).reviews.list()
        #expect(recorder.request?.url?.absoluteString.contains("source") == false)
    }

    @Test("The summary comes from the bundle, and the histogram runs 5 to 1 with missing stars at 0")
    func summary() async throws {
        let recorder = StubTransport.Recorder()
        let summary = try #require(try await client(#"""
        {"pageKey":"home","locale":"en","sections":{},"availableLocales":["en"],
         "reviews":{"enabled":true,"source":"org_external_reviews","placeId":null,"rating":4.5,"totalCount":4,
           "counts":[{"rating":5,"count":3},{"rating":3,"count":1}],
           "items":[{"reviewee":"Ana","rating":5,"image":null,"description":"Great","date":"2026-11-01","platform":"Google"}],
           "cachedAt":"2026-11-01"}}
        """#, recorder: recorder).reviews.summary())
        #expect(recorder.request?.url?.path.hasSuffix("sites/site-123/marketing/bundle") == true)
        #expect(summary.rating == 4.5)
        let histogram = summary.histogram
        #expect(histogram.map(\.stars) == [5, 4, 3, 2, 1])
        #expect(histogram.map(\.count) == [3, 0, 1, 0, 0])
        #expect(histogram.first?.share == 0.75)
    }

    @Test("No reviews section in the bundle is no summary")
    func noSummary() async throws {
        let summary = try await client(#"{"pageKey":"home","locale":"en","sections":{},"availableLocales":["en"]}"#)
            .reviews.summary()
        #expect(summary == nil)
    }

    @Test("A written review leaves out what wasn't given and goes with the customer's session")
    func submit() async throws {
        let recorder = StubTransport.Recorder()
        let sent = try await client(#"{"id":"r9","status":"pending","submittedAt":"2026-11-25T00:00:00Z"}"#, recorder: recorder)
            .portal(sessionToken: "tok")
            .submitReview(ReviewInput(rating: 5, body: "Lovely"))
        #expect(sent.status == "pending")
        let body = try #require(recorder.request?.httpBody)
        let json = try #require(try JSONSerialization.jsonObject(with: body) as? [String: Any])
        #expect(json["rating"] as? Int == 5)
        #expect(json["body"] as? String == "Lovely")
        #expect(json["title"] == nil)
        #expect(json["jobId"] == nil)
        #expect(recorder.request?.url?.path.hasSuffix("customer-portal/reviews") == true)
    }

    @Test("Platforms are named; a dashboard review has no platform to show")
    func sources() {
        #expect(ReviewSource.label("google") == "Google")
        #expect(ReviewSource.label("housecall_pro") == "Housecall Pro")
        #expect(ReviewSource.label("other") == "Other")
        #expect(ReviewSource.platform("yelp") == "Yelp")
        #expect(ReviewSource.platform("other") == nil)
    }
}
