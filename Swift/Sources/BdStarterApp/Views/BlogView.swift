import BusinessDashKit
import SwiftUI

/// The blog: category and tag filters, pinned posts first, older posts on
/// demand.
struct BlogView: View {
    @Environment(BdEnvironment.self) private var bd
    @State private var model = BlogViewModel()

    var body: some View {
        LoadableView(state: model.state) { posts in
            List {
                if !model.categories.isEmpty || !model.tags.isEmpty {
                    Section { filters }
                }
                if let description = model.activeCategory?.description, !description.isEmpty {
                    Text(description).foregroundStyle(.secondary)
                }
                ForEach(Array(posts.enumerated()), id: \.element.id) { index, post in
                    NavigationLink {
                        PostView(slug: post.slug)
                    } label: {
                        PostRow(post: post, lead: index == 0 && model.filter == .init())
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

    private var filters: some View {
        VStack(alignment: .leading, spacing: 8) {
            if !model.categories.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        filterChip("All", on: model.filter.categoryID == nil) { model.filter.categoryID = nil }
                        ForEach(model.categories) { category in
                            filterChip(category.name, on: model.filter.categoryID == category.id) {
                                model.filter.categoryID = category.id
                            }
                        }
                    }
                }
            }
            if !model.tags.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(model.tags, id: \.self) { tag in
                            let on = model.filter.tag == tag
                            filterChip("#\(tag)", on: on, small: true) { model.filter.tag = on ? nil : tag }
                        }
                    }
                }
            }
        }
        .buttonStyle(.bordered)
        .buttonBorderShape(.capsule)
    }

    private func filterChip(_ title: String, on: Bool, small: Bool = false, action: @escaping () -> Void) -> some View {
        Button(title, action: action)
            .font(small ? .caption : .subheadline)
            .tint(on ? .accentColor : .secondary)
            .accessibilityAddTraits(on ? .isSelected : [])
    }
}

private struct PostRow: View {
    let post: BlogPost
    /// The newest post on the first page is drawn larger.
    let lead: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let image = post.imageUrl, !image.isEmpty {
                CoverImage(url: image, height: lead ? 180 : 120)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            HStack(spacing: 6) {
                if post.isPinned == true { Badge("Pinned") }
                Text(PostHtml.date(post.publishedAt))
                Text("· \(PostHtml.readingMinutes(post.content ?? post.excerpt)) min read")
            }
            .font(.caption)
            .foregroundStyle(.secondary)
            Text(post.title).font(lead ? .title3.bold() : .headline)
            if let excerpt = post.excerpt, !excerpt.isEmpty {
                Text(excerpt).font(.subheadline).foregroundStyle(.secondary).lineLimit(3)
            }
            if let author = post.authorName, !author.isEmpty {
                Text(author).font(.caption.weight(.semibold))
            }
        }
        .padding(.vertical, 4)
    }
}
