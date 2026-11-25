import Foundation
import Testing
@testable import App

/// The reviews' rules, which must agree with reviews.ts in the other BD starters.
struct ReviewsTests {
    private func json(_ text: String) throws -> JSONValue {
        try JSONDecoder().decode(JSONValue.self, from: Data(text.utf8))
    }

    @Test func summaryBreaksTheRatingDownByStars() throws {
        let totals = try json("""
        {"rating": 4.1, "totalCount": 14, "counts": [
          {"rating": 5, "count": 8}, {"rating": 4, "count": 3}, {"rating": 2, "count": 1},
          {"rating": 1, "count": 2}, {"rating": 9, "count": 5}
        ]}
        """)
        let summary = Reviews.summarize(totals)
        #expect(summary.average == 4.1)
        #expect(summary.total == 14)
        #expect(summary.histogram.map(\.stars) == [5, 4, 3, 2, 1])
        #expect(summary.histogram.map(\.count) == [8, 3, 0, 1, 2])
        #expect(abs(summary.histogram[0].share - 8.0 / 14.0) < 1e-9)
    }

    @Test func withNoBundleThereIsNoAverage() {
        let summary = Reviews.summarize(nil, fallbackTotal: 3)
        #expect(summary.average == nil)
        #expect(summary.total == 3)
        #expect(summary.histogram[0].share == 0)
    }

    private func review(source: String?, url: String? = nil, name: String? = nil) -> Review {
        Review(
            id: "r", source: source, rating: 4, text: "x", reviewUrl: url, reviewerName: name,
            reviewerImageUrl: nil, photos: nil, timeCreated: nil, verified: nil
        )
    }

    @Test func linksOpenOnlyOnNamedPlatformsAndTheWeb() {
        #expect(Reviews.link(review(source: "google", url: "https://maps.google.com/?r=1")) == "https://maps.google.com/?r=1")
        #expect(Reviews.link(review(source: "yelp", url: "javascript:alert(1)")) == nil)
        #expect(Reviews.link(review(source: "other", url: "https://example.com/r")) == nil)
        #expect(Reviews.webURL("//example.com/x.jpg") == nil)
        #expect(Reviews.platformName("other") == nil)
        #expect(Reviews.sourceLabel("other") == "Other")
        #expect(Reviews.sourceParam("tripadvisor") == nil)
        #expect(Reviews.sourcesIn([review(source: "google"), review(source: "other"), review(source: "google")]) == ["google", "other"])
    }

    @Test func namesStarsAndDates() {
        #expect(Reviews.reviewerName(review(source: nil, name: "  ")) == "Anonymous")
        #expect(Reviews.initial(review(source: nil, name: "élodie")) == "É")
        #expect(Reviews.stars(4.1) == "★★★★☆")
        #expect(Reviews.stars(nil) == "☆☆☆☆☆")
        #expect(Reviews.date("2026-11-20T15:00:00Z") == "Nov 20, 2026")
        #expect(Reviews.date("2026-11-20T15:00:00.000Z") == "Nov 20, 2026")
        #expect(Reviews.date("not a date") == "")
    }

    @Test func aWrittenReviewIsChecked() throws {
        #expect(Reviews.check(try json(#"{"rating": 6, "body": "Good"}"#)) == .refused("Choose a rating from 1 to 5 stars."))
        #expect(Reviews.check(try json(#"{"rating": 4.5, "body": "Good"}"#)) == .refused("Choose a rating from 1 to 5 stars."))
        #expect(Reviews.check(try json(#"{"rating": 4, "body": "   "}"#)) == .refused("Write a few words about your experience."))
        let long = String(repeating: "a", count: 5001)
        #expect(Reviews.check(try json(#"{"rating": 4, "body": "\#(long)"}"#)) == .refused("Reviews are up to 5,000 characters."))
        #expect(
            Reviews.check(try json(#"{"rating": 4, "title": " ", "body": " Good fitting. "}"#))
                == .ok(Reviews.Input(rating: 4, title: nil, body: "Good fitting."))
        )
        let title = String(repeating: "t", count: 300)
        guard case .ok(let input) = Reviews.check(try json(#"{"rating": 5, "title": "\#(title)", "body": "x"}"#)) else {
            Issue.record("refused")
            return
        }
        #expect(input.title?.count == 200)
    }
}
