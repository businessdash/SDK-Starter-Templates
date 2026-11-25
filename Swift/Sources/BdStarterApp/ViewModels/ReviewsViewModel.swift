import BusinessDashKit
import Foundation
import Observation

/// The business's reviews: the rating over all of them, a page at a time,
/// one platform or all, and writing one.
@MainActor
@Observable
final class ReviewsViewModel: ScreenViewModel {
    var bd: BdEnvironment?

    static let pageSize = 10

    struct Page: Sendable {
        var reviews: [Review]
        var total: Int
        var nextOffset: Int?
    }

    /// nil: every platform.
    var source: String?
    private(set) var summary: ReviewSummary?
    private(set) var state: LoadState<Page> = .loading
    private(set) var loadingMore = false
    /// The platforms the business has reviews on, for the filter.
    private(set) var sources: [String] = []

    func load() async {
        guard let client else {
            state = .loaded(Page(reviews: [], total: 0, nextOffset: nil))
            return
        }
        if summary == nil {
            summary = try? await client.reviews.summary()
        }
        let source = source
        state = await LoadState {
            let page = try await client.reviews.list(limit: Self.pageSize, source: source)
            return Page(reviews: page.items, total: page.totalCount ?? page.items.count, nextOffset: page.nextOffset)
        }
        // Learn the platforms from the unfiltered list, keeping their order.
        if source == nil, case .loaded(let page) = state {
            var seen: [String] = []
            for review in page.reviews {
                if let source = review.source, !seen.contains(source) { seen.append(source) }
            }
            if seen.count > 1 { sources = seen }
        }
    }

    func loadMore() async {
        guard let client, case .loaded(var page) = state, let offset = page.nextOffset else { return }
        loadingMore = true
        defer { loadingMore = false }
        guard let next = try? await client.reviews.list(limit: Self.pageSize, offset: offset, source: source) else { return }
        let shown = Set(page.reviews.map(\.id))
        page.reviews += next.items.filter { !shown.contains($0.id) }
        page.nextOffset = next.nextOffset
        state = .loaded(page)
    }
}

/// Writing a review: a signed-in customer's, sent to the business to approve.
@MainActor
@Observable
final class ReviewWriterModel {
    static let maxLength = 5000

    var rating = 0
    var title = ""
    var text = ""
    private(set) var sending = false
    private(set) var error: String?
    private(set) var sent = false

    var canSend: Bool {
        rating > 0 && !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && text.count <= Self.maxLength && !sending
    }

    func send(with portal: PortalResource?) async {
        guard let portal else {
            error = "Sign in to write a review."
            return
        }
        sending = true
        defer { sending = false }
        let title = title.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            try await portal.submitReview(ReviewInput(
                rating: rating,
                title: title.isEmpty ? nil : title,
                body: text.trimmingCharacters(in: .whitespacesAndNewlines)
            ))
            sent = true
            error = nil
        } catch {
            self.error = (error as? BdError)?.errorDescription ?? "Couldn't send your review. Try again."
        }
    }
}
