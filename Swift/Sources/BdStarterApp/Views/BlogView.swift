import BusinessDashKit
import SwiftUI

/// The blog: category and tag filters, pinned posts first, older posts on
/// demand. It's laid out from `BlogFilters` and a `PostCard` per post
/// (BlogParts.swift).
public struct BlogView: View {
    @Environment(BdEnvironment.self) private var bd
    @State private var model = BlogViewModel()

    public init() {}

    public var body: some View {
        LoadableView(state: model.state) { posts in
            List {
                if !model.categories.isEmpty || !model.tags.isEmpty {
                    Section {
                        BlogFilters(
                            categories: model.categories,
                            tags: model.tags,
                            categoryID: model.filter.categoryID,
                            tag: model.filter.tag,
                            onCategory: { model.filter.categoryID = $0 },
                            onTag: { model.filter.tag = $0 }
                        )
                    }
                }
                if let description = model.activeCategory?.description, !description.isEmpty {
                    Text(description).foregroundStyle(.secondary)
                }
                ForEach(Array(posts.enumerated()), id: \.element.id) { index, post in
                    NavigationLink {
                        PostView(slug: post.slug)
                    } label: {
                        PostCard(post: post, lead: index == 0 && model.filter == .init())
                    }
                }
                if model.nextCursor != nil {
                    Button(model.loadingMore ? "Loading…" : "Older posts") {
                        Task { await model.loadOlder() }
                    }
                    .disabled(model.loadingMore)
                }
            }
            .overlay {
                if posts.isEmpty {
                    ContentUnavailableView(
                        "No posts here yet",
                        systemImage: "text.book.closed",
                        description: Text(model.filter == .init()
                            ? "Write one in Business Dash and it'll appear here."
                            : "Try another topic.")
                    )
                }
            }
        }
        .navigationTitle(model.activeCategory?.name ?? "Blog")
        .task(id: model.filter) {
            model.bind(bd)
            await model.load()
        }
        .refreshable { await model.load() }
    }
}
