import BusinessDashKit
import Foundation
import Observation

/// The post list: pinned first, category and tag filters, older posts.
///
/// The API filters by category only, so a tag is matched here, over the
/// newest 50 posts — enough for a starter's blog, and the same rule as the
/// web starters.
@MainActor
@Observable
final class BlogViewModel: ScreenViewModel {
    var bd: BdEnvironment?

    static let pageSize = 12

    struct Filter: Hashable, Sendable {
        var categoryID: String?
        var tag: String?
    }

    var filter = Filter()
    private(set) var state: LoadState<[BlogPost]> = .loading
    private(set) var categories: [BlogCategory] = []
    private(set) var tags: [String] = []
    private(set) var nextCursor: Int?
    private(set) var loadingMore = false

    var activeCategory: BlogCategory? { categories.first { $0.id == filter.categoryID } }

    func load() async {
        guard let client else {
            state = .loaded([])
            return
        }
        if categories.isEmpty { categories = (try? await client.blog.categories().items) ?? [] }
        if tags.isEmpty { tags = (try? await client.blog.tags().items) ?? [] }

        let filter = filter
        var cursor: Int?
        state = await LoadState {
            let page = try await client.blog.posts(
                limit: filter.tag == nil ? Self.pageSize : 50,
                categoryID: filter.categoryID
            )
            cursor = filter.tag == nil ? page.nextCursor : nil
            let posts = page.posts.filter { filter.tag == nil || ($0.tags ?? []).contains(filter.tag!) }
            // Pinned first; the rest keep their order.
            return posts.filter { $0.isPinned == true } + posts.filter { $0.isPinned != true }
        }
        nextCursor = cursor
    }

    /// The next page, added under the posts already shown.
    func loadOlder() async {
        guard let client, let cursor = nextCursor, case .loaded(let posts) = state else { return }
        loadingMore = true
        defer { loadingMore = false }
        guard let page = try? await client.blog.posts(limit: Self.pageSize, cursor: cursor, categoryID: filter.categoryID) else {
            return
        }
        let shown = Set(posts.map(\.id))
        state = .loaded(posts + page.posts.filter { !shown.contains($0.id) })
        nextCursor = page.nextCursor
    }
}

/// One post: its body as native blocks, its likes and comments.
@MainActor
@Observable
final class PostViewModel: ScreenViewModel {
    var bd: BdEnvironment?

    struct Loaded: Sendable {
        let post: BlogPost
        let paywalled: Bool
        let blocks: [PostBlock]
        let minutes: Int
    }

    let slug: String
    private(set) var state: LoadState<Loaded> = .loading
    private(set) var likes: PostLikes?
    private(set) var comments: [BlogComment] = []
    private(set) var liking = false
    private(set) var posting = false
    private(set) var note: (text: String, ok: Bool)?
    var draft = ""

    init(slug: String) {
        self.slug = slug
    }

    var signedIn: Bool { bd?.memberSessionToken != nil }

    func load() async {
        guard let client else {
            state = .failed("The blog isn't connected yet.", isUnavailable: false)
            return
        }
        state = await LoadState {
            let detail = try await client.blog.post(slug: slug)
            return Loaded(
                post: detail.post,
                paywalled: detail.isPaywalled,
                blocks: PostBlocks.from(detail.post.content),
                minutes: PostHtml.readingMinutes(detail.post.content)
            )
        }
        guard case .loaded(let loaded) = state else { return }
        likes = (try? await client.blog.likes(slug: slug, sessionToken: bd?.memberSessionToken))
            ?? PostLikes(liked: false, likesCount: loaded.post.likes ?? 0)
        comments = (try? await client.blog.comments(slug: slug).comments) ?? []
    }

    func toggleLike() async {
        guard let client, let token = bd?.memberSessionToken else { return }
        liking = true
        defer { liking = false }
        if let result = try? await client.blog.toggleLike(slug: slug, sessionToken: token) {
            likes = result
        }
    }

    func postComment() async {
        let content = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let client, let token = bd?.memberSessionToken, !content.isEmpty else { return }
        guard content.count <= 5000 else {
            note = ("Comments are up to 5,000 characters.", false)
            return
        }
        posting = true
        defer { posting = false }
        do {
            let posted = try await client.blog.comment(slug: slug, content: content, sessionToken: token)
            draft = ""
            note = posted.moderation.isApproved
                ? ("Comment posted.", true)
                : ("Thanks! Your comment shows once it's approved.", true)
            comments = (try? await client.blog.comments(slug: slug).comments) ?? comments
        } catch {
            note = ((error as? BdError)?.errorDescription ?? "Couldn't post your comment. Try again.", false)
        }
    }
}
