import BusinessDashKit
import SwiftUI

struct BlogView: View {
    @Environment(BiabEnvironment.self) private var biab
    @State private var model = BlogViewModel()

    var body: some View {
        LoadableView(state: model.state) { posts in
            List(posts) { post in
                VStack(alignment: .leading, spacing: 4) {
                    Text(post.title).font(.headline)
                    if let excerpt = post.excerpt {
                        Text(excerpt).font(.subheadline).foregroundStyle(.secondary)
                    }
                    if let published = post.publishedAt {
                        Text(published).font(.caption).foregroundStyle(.tertiary)
                    }
                }
            }
            .overlay {
                if posts.isEmpty {
                    ContentUnavailableView("No posts yet", systemImage: "text.book.closed")
                }
            }
        }
        .navigationTitle("Blog")
        .task {
            model.bind(biab)
            await model.load()
        }
    }
}
