import BiabKit
import SwiftUI

struct BlogView: View {
    @Environment(BiabEnvironment.self) private var biab
    @State private var state: LoadState<[BlogPost]> = .loading

    var body: some View {
        LoadableView(state: state) { posts in
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
            guard let client = biab.client else {
                state = .loaded([])
                return
            }
            state = await LoadState { try await client.blog.posts().posts }
        }
    }
}
