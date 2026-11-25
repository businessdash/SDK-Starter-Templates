import BusinessDashKit
import SwiftUI

/// One post. Its HTML is read into native blocks (`PostBlocks`, which keeps
/// only the allowlisted tags), so nothing of the raw HTML runs. Liking and
/// commenting need a signed-in customer; signed out, they lead to the
/// Account tab.
///
/// It's laid out from parts (BlogParts.swift): `PostMeta`, `PostBodyView`
/// or `MembersOnly`, `PostCTA`, `PostTags`, `LikeButton` and `PostComments`.
public struct PostView: View {
    @Environment(BdEnvironment.self) private var bd
    @State private var model: PostViewModel

    public init(slug: String) {
        _model = State(initialValue: PostViewModel(slug: slug))
    }

    public var body: some View {
        LoadableView(state: model.state) { loaded in
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    header(loaded)
                    if let image = loaded.post.imageUrl, !image.isEmpty {
                        RemoteImage(url: image, contentMode: .fit)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    if loaded.paywalled {
                        MembersOnly { bd.tab = .account }
                    } else {
                        PostBodyView(blocks: loaded.blocks)
                    }
                    PostCTA(post: loaded.post)
                    PostTags(tags: loaded.post.tags)
                    Divider()
                    LikeButton(
                        signedIn: model.signedIn,
                        likes: model.likes,
                        liking: model.liking,
                        onToggle: { Task { await model.toggleLike() } },
                        onSignIn: { bd.tab = .account }
                    )
                    comments
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
            PostMeta(post: loaded.post, minutes: loaded.minutes)
        }
    }

    private var comments: some View {
        @Bindable var model = model
        return PostComments(
            comments: model.comments,
            signedIn: model.signedIn,
            draft: $model.draft,
            posting: model.posting,
            note: model.note?.text,
            noteOK: model.note?.ok ?? true,
            onPost: { Task { await model.postComment() } },
            onSignIn: { bd.tab = .account }
        )
    }
}

/// A post's blocks as SwiftUI views.
public struct PostBodyView: View {
    public let blocks: [PostBlock]

    public init(blocks: [PostBlock]) {
        self.blocks = blocks
    }

    public var body: some View {
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
