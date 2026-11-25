import BusinessDashKit
import SwiftUI

/// One post. Its HTML is read into native blocks (`PostBlocks`, which keeps
/// only the allowlisted tags), so nothing of the raw HTML runs. Liking and
/// commenting need a signed-in customer; signed out, they lead to the
/// Account tab.
struct PostView: View {
    @Environment(BdEnvironment.self) private var bd
    @State private var model: PostViewModel

    init(slug: String) {
        _model = State(initialValue: PostViewModel(slug: slug))
    }

    var body: some View {
        LoadableView(state: model.state) { loaded in
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    header(loaded)
                    if let image = loaded.post.imageUrl, !image.isEmpty {
                        RemoteImage(url: image, contentMode: .fit)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    if loaded.paywalled {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("This post is for members.").font(.headline)
                            Button("Sign in to read it") { bd.tab = .account }.buttonStyle(.borderedProminent)
                        }
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 12))
                    } else {
                        PostBodyView(blocks: loaded.blocks)
                    }
                    cta(loaded.post)
                    tags(loaded.post)
                    Divider()
                    likeRow
                    commentsSection
                }
                .padding()
            }
            .navigationTitle(loaded.post.title)
            // The page shows the title large already.
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                if let site = bd.configuration?.siteURL {
                    ToolbarItem(placement: .primaryAction) {
                        ShareLink(item: site.appending(path: "blog/\(loaded.post.slug)"))
                    }
                }
            }
        }
        .task(id: bd.memberSessionToken) {
            model.bind(bd)
            await model.load()
        }
    }

    private func header(_ loaded: PostViewModel.Loaded) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(loaded.post.title).font(.largeTitle.bold())
            HStack(spacing: 8) {
                if let avatar = loaded.post.authorAvatarUrl, !avatar.isEmpty {
                    RemoteImage(url: avatar).frame(width: 24, height: 24).clipShape(Circle())
                }
                if let author = loaded.post.authorName, !author.isEmpty {
                    Text(author).fontWeight(.semibold)
                }
                Text(PostHtml.date(loaded.post.publishedAt))
                Text("· \(loaded.minutes) min read")
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }
    }

    /// The post's call to action. Only web and mail links open.
    @ViewBuilder private func cta(_ post: BlogPost) -> some View {
        if let label = post.ctaLabel, !label.isEmpty, let href = post.ctaHref,
           let url = URL(string: href), ["http", "https", "mailto"].contains(url.scheme?.lowercased() ?? "") {
            VStack(alignment: .leading, spacing: 10) {
                if let description = post.ctaDescription, !description.isEmpty { Text(description) }
                Link(label, destination: url).buttonStyle(.borderedProminent)
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.quaternary.opacity(0.4), in: RoundedRectangle(cornerRadius: 12))
        }
    }

    @ViewBuilder private func tags(_ post: BlogPost) -> some View {
        if let tags = post.tags, !tags.isEmpty {
            FlowLayout(spacing: 10) {
                ForEach(tags, id: \.self) { Text("#\($0)").font(.caption).foregroundStyle(.secondary) }
            }
        }
    }

    @ViewBuilder private var likeRow: some View {
        HStack(spacing: 10) {
            if model.signedIn {
                Button {
                    Task { await model.toggleLike() }
                } label: {
                    Label(model.likes?.liked == true ? "Liked" : "Like", systemImage: model.likes?.liked == true ? "heart.fill" : "heart")
                }
                .buttonStyle(.bordered)
                .tint(model.likes?.liked == true ? .pink : .primary)
                .disabled(model.liking)
            } else {
                Button {
                    bd.tab = .account
                } label: {
                    Label("Sign in to like", systemImage: "heart")
                }
                .buttonStyle(.bordered)
            }
            if let count = model.likes?.likesCount {
                Text("\(count) \(count == 1 ? "like" : "likes")").font(.subheadline).foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder private var commentsSection: some View {
        @Bindable var model = model
        VStack(alignment: .leading, spacing: 12) {
            Text(model.comments.count == 1 ? "1 comment" : "\(model.comments.count) comments").font(.title3.bold())
            if model.signedIn {
                TextField("Add a comment", text: $model.draft, axis: .vertical)
                    .lineLimit(3...8)
                    .textFieldStyle(.roundedBorder)
                Button(model.posting ? "Posting…" : "Post comment") {
                    Task { await model.postComment() }
                }
                .buttonStyle(.borderedProminent)
                .disabled(model.posting || model.draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            } else {
                Button("Sign in to comment") { bd.tab = .account }.buttonStyle(.bordered)
            }
            if let note = model.note {
                Text(note.text).font(.footnote).foregroundStyle(note.ok ? Color.secondary : Color.red)
            }
            ForEach(model.comments) { comment in
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Text(comment.authorName ?? "Reader").font(.subheadline.weight(.semibold))
                        Text(PostHtml.date(comment.createdAt)).font(.caption).foregroundStyle(.secondary)
                    }
                    Text(comment.content).font(.subheadline)
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(.quaternary.opacity(0.35), in: RoundedRectangle(cornerRadius: 10))
            }
        }
    }
}

/// A post's blocks as SwiftUI views.
struct PostBodyView: View {
    let blocks: [PostBlock]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            ForEach(Array(blocks.enumerated()), id: \.offset) { _, block in
                view(for: block)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder private func view(for block: PostBlock) -> some View {
        switch block {
        case .heading(let level, let text):
            Text(text).font(level <= 2 ? .title2.bold() : level == 3 ? .title3.bold() : .headline)
                .padding(.top, 6)
        case .paragraph(let text):
            Text(text).lineSpacing(4)
        case .quote(let text):
            Text(text)
                .foregroundStyle(.secondary)
                .padding(.leading, 12)
                .overlay(alignment: .leading) { Rectangle().fill(Color.accentColor).frame(width: 3) }
        case .list(let items):
            VStack(alignment: .leading, spacing: 6) {
                ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(item.marker).frame(minWidth: 18, alignment: .trailing).foregroundStyle(.secondary)
                        Text(item.text)
                    }
                    .padding(.leading, CGFloat(item.depth) * 18)
                }
            }
        case .code(let code):
            ScrollView(.horizontal) {
                Text(code).font(.system(.callout, design: .monospaced)).padding(12)
            }
            .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 8))
        case .image(let url, let alt):
            AsyncImage(url: url) { image in
                image.resizable().aspectRatio(contentMode: .fit)
            } placeholder: {
                Color.secondary.opacity(0.08).frame(height: 180)
            }
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .accessibilityLabel(alt)
        case .caption(let text):
            Text(text).font(.caption).foregroundStyle(.secondary)
        case .table(let rows):
            ScrollView(.horizontal) {
                Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 8) {
                    ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                        GridRow {
                            ForEach(Array(row.cells.enumerated()), id: \.offset) { _, cell in
                                Text(cell).fontWeight(row.isHeader ? .semibold : .regular)
                            }
                        }
                    }
                }
                .padding(.vertical, 4)
            }
        case .rule:
            Divider()
        }
    }
}
