import Foundation
import Vapor

/// The business reviews' rules: the rating over every review and its stars
/// breakdown, what each platform is called, which links are safe to open,
/// and what a written review must be. The same rules as `reviews.ts` in the
/// other BD starters (Public/shop/reviews.js here, for the writer element).
enum Reviews {
    static let pageSize = 10
    /// The longest review BD takes.
    static let maxLength = 5000
    static let sent = "Thanks! Your review shows once it's approved."

    private static let platforms = ["google": "Google", "yelp": "Yelp", "housecall_pro": "Housecall Pro"]
    private static let sources = ["google", "yelp", "housecall_pro", "other"]

    struct Bar: Equatable {
        let stars: Int
        let count: Int
        /// This star's share of all the reviews counted, 0...1.
        let share: Double
    }

    struct Summary: Equatable {
        let average: Double?
        let total: Int
        /// 5 stars down to 1; empty stars count 0.
        let histogram: [Bar]
    }

    /// The average, the count and the breakdown, from the marketing bundle's `reviews`.
    static func summarize(_ totals: JSONValue?, fallbackTotal: Int = 0) -> Summary {
        var byStars: [Int: Int] = [:]
        for row in totals?["counts"]?.arrayValue ?? [] {
            guard case .number(let stars)? = row["rating"], case .number(let count)? = row["count"],
                  stars == stars.rounded(), (1...5).contains(Int(stars)), count > 0
            else { continue }
            byStars[Int(stars), default: 0] += Int(count)
        }
        let counted = byStars.values.reduce(0, +)
        var average: Double?
        if case .number(let rating)? = totals?["rating"], rating.isFinite { average = rating }
        return Summary(
            average: average,
            total: totals?["totalCount"]?.intValue ?? (counted > 0 ? counted : fallbackTotal),
            histogram: (1...5).reversed().map { stars in
                let count = byStars[stars] ?? 0
                return Bar(stars: stars, count: count, share: counted > 0 ? Double(count) / Double(counted) : 0)
            }
        )
    }

    /// "Google", "Yelp", "Housecall Pro"; nil for a review added in the dashboard.
    static func platformName(_ source: String?) -> String? {
        source.flatMap { platforms[$0] }
    }

    /// A filter chip's name: the platform, or "Other".
    static func sourceLabel(_ source: String?) -> String {
        platformName(source) ?? "Other"
    }

    /// A `source` query value BD accepts, or nil.
    static func sourceParam(_ value: String?) -> String? {
        value.flatMap { sources.contains($0) ? $0 : nil }
    }

    /// The platforms among some reviews, in the order first seen.
    static func sourcesIn(_ reviews: [Review]) -> [String] {
        var seen: [String] = []
        for review in reviews {
            if let source = sourceParam(review.source), !seen.contains(source) { seen.append(source) }
        }
        return seen
    }

    /// The review on its own site; web links on named platforms only.
    static func link(_ review: Review) -> String? {
        platformName(review.source) == nil ? nil : webURL(review.reviewUrl)
    }

    /// An http(s) address, or nil.
    static func webURL(_ url: String?) -> String? {
        guard let url, !url.isEmpty,
              let parts = URLComponents(string: url),
              let scheme = parts.scheme?.lowercased(), scheme == "http" || scheme == "https",
              let host = parts.host, !host.isEmpty
        else { return nil }
        return url
    }

    static func reviewerName(_ review: Review) -> String {
        let name = (review.reviewerName ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return name.isEmpty ? "Anonymous" : name
    }

    /// The first letter of the name, for an avatar with no photo.
    static func initial(_ review: Review) -> String {
        String(reviewerName(review).prefix(1)).uppercased()
    }

    /// "★★★★☆", rounded to whole stars.
    static func stars(_ rating: Double?) -> String {
        let value = rating ?? 0
        let full = value.isFinite ? max(0, min(5, Int(value.rounded()))) : 0
        return String(repeating: "★", count: full) + String(repeating: "☆", count: 5 - full)
    }

    /// "Nov 20, 2026", or "" for a date that isn't one.
    static func date(_ iso: String?) -> String {
        guard let iso, !iso.isEmpty else { return "" }
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        guard let date = parser.date(from: iso) ?? plain.date(from: iso) else { return "" }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "MMM d, yyyy"
        return formatter.string(from: date)
    }

    /// What a customer wrote, as BD takes it. `title` is left out when empty.
    struct Input: Content, Equatable {
        let rating: Int
        let title: String?
        let body: String
    }

    enum Checked: Equatable {
        case ok(Input)
        case refused(String)
    }

    /// A written review, checked: the fields BD takes, or why it can't go.
    static func check(_ input: JSONValue) -> Checked {
        guard case .number(let rating)? = input["rating"], rating == rating.rounded(), (1.0...5.0).contains(rating) else {
            return .refused("Choose a rating from 1 to 5 stars.")
        }
        let body = (input["body"]?.stringValue ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if body.isEmpty { return .refused("Write a few words about your experience.") }
        if body.count > maxLength { return .refused("Reviews are up to 5,000 characters.") }
        let title = String((input["title"]?.stringValue ?? "").trimmingCharacters(in: .whitespacesAndNewlines).prefix(200))
        return .ok(Input(rating: Int(rating), title: title.isEmpty ? nil : title, body: body))
    }
}
