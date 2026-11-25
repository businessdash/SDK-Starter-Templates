import BusinessDashKit
import SwiftUI

// The blog's parts. `BlogView` and `PostView` lay them out; each takes plain
// values and callbacks, so you can move, restyle, drop or replace any of
// them. The post's body is `PostBodyView` (PostView.swift).

/// All and a chip per category, then the tags; choosing the chosen tag again
/// clears it.
public struct BlogFilters: View {
    public let categories: [BlogCategory]
    public let tags: [String]
    public let categoryID: String?
    public let tag: String?
    public let onCategory: (String?) -> Void
    public let onTag: (String?) -> Void

    public init(
        categories: [BlogCategory],
        tags: [String],
        categoryID: String?,
        tag: String?,
        onCategory: @escaping (String?) -> Void,
        onTag: @escaping (String?) -> Void
    ) {
        self.categories = categories
        self.tags = tags
        self.categoryID = categoryID
        self.tag = tag
        self.onCategory = onCategory
        self.onTag = onTag
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if !categories.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        chip("All", on: categoryID == nil) { onCategory(nil) }
                        ForEach(categories) { category in
                            chip(category.name, on: categoryID == category.id) { onCategory(category.id) }
                        }
                    }
                }
            }
            if !tags.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(tags, id: \.self) { each in
                            let on = tag == each
                            chip("#\(each)", on: on, small: true) { onTag(on ? nil : each) }
                        }
                    }
                }
            }
        }
        .buttonStyle(.bordered)
        .buttonBorderShape(.capsule)
    }

    private func chip(_ title: String, on: Bool, small: Bool = false, action: @escaping () -> Void) -> some View {
        Button(title, action: action)
            .font(small ? .caption : .subheadline)
            .tint(on ? .accentColor : .secondary)
            .accessibilityAddTraits(on ? .isSelected : [])
    }
}

/// A post in the list: cover, Pinned, date, reading time, title, excerpt and
/// author.
public struct PostCard: View {
    public let post: BlogPost
    /// The newest post on the first page is drawn larger.
    public let lead: Bool

    public init(post: BlogPost, lead: Bool = false) {
        self.post = post
        self.lead = lead
    }

    public var body: some View {
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

/// The author with their photo, the date and the reading time.
public struct PostMeta: View {
    public let post: BlogPost
    public let minutes: Int

    public init(post: BlogPost, minutes: Int) {
        self.post = post
        self.minutes = minutes
    }

    public var body: some View {
        HStack(spacing: 8) {
            if let avatar = post.authorAvatarUrl, !avatar.isEmpty {
                RemoteImage(url: avatar).frame(width: 24, height: 24).clipShape(Circle())
            }
            if let author = post.authorName, !author.isEmpty {
                Text(author).fontWeight(.semibold)
            }
            Text(PostHtml.date(post.publishedAt))
            Text("· \(minutes) min read")
        }
        .font(.subheadline)
        .foregroundStyle(.secondary)
    }
}

/// In place of a members' post for visitors: Sign in to read it.
public struct MembersOnly: View {
    public let onSignIn: () -> Void

    public init(onSignIn: @escaping () -> Void) {
        self.onSignIn = onSignIn
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("This post is for members.").font(.headline)
            Button("Sign in to read it", action: onSignIn).buttonStyle(.borderedProminent)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 12))
    }
}

/// The post's call to action, when it has one. Only web and mail links open.
public struct PostCTA: View {
    public let post: BlogPost

    public init(post: BlogPost) {
        self.post = post
    }

    public var body: some View {
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
}

/// The post's tags.
public struct PostTags: View {
    public let tags: [String]

    public init(tags: [String]?) {
        self.tags = tags ?? []
    }

    public var body: some View {
        if !tags.isEmpty {
            FlowLayout(spacing: 10) {
                ForEach(tags, id: \.self) { Text("#\($0)").font(.caption).foregroundStyle(.secondary) }
            }
        }
    }
}

/// ♡ Like with the count. Signed out, it leads to sign-in.
public struct LikeButton: View {
    public let signedIn: Bool
    public let likes: PostLikes?
    public let liking: Bool
    public let onToggle: () -> Void
    public let onSignIn: () -> Void

    public init(
        signedIn: Bool,
        likes: PostLikes?,
        liking: Bool = false,
        onToggle: @escaping () -> Void,
        onSignIn: @escaping () -> Void
    ) {
        self.signedIn = signedIn
        self.likes = likes
        self.liking = liking
        self.onToggle = onToggle
        self.onSignIn = onSignIn
    }

    public var body: some View {
        HStack(spacing: 10) {
            if signedIn {
                Button(action: onToggle) {
                    Label(likes?.liked == true ? "Liked" : "Like", systemImage: likes?.liked == true ? "heart.fill" : "heart")
                }
                .buttonStyle(.bordered)
                .tint(likes?.liked == true ? .pink : .primary)
                .disabled(liking)
            } else {
                Button(action: onSignIn) {
                    Label("Sign in to like", systemImage: "heart")
                }
                .buttonStyle(.bordered)
            }
            if let count = likes?.likesCount {
                Text("\(count) \(count == 1 ? "like" : "likes")").font(.subheadline).foregroundStyle(.secondary)
            }
        }
    }
}

/// The comments and, signed in, a box to add one; signed out, a way to sign
/// in.
public struct PostComments: View {
    public let comments: [BlogComment]
    public let signedIn: Bool
    @Binding public var draft: String
    public let posting: Bool
    /// After posting: what happened, and whether it went well.
    public let note: String?
    public let noteOK: Bool
    public let onPost: () -> Void
    public let onSignIn: () -> Void

    public init(
        comments: [BlogComment],
        signedIn: Bool,
        draft: Binding<String>,
        posting: Bool = false,
        note: String? = nil,
        noteOK: Bool = true,
        onPost: @escaping () -> Void,
        onSignIn: @escaping () -> Void
    ) {
        self.comments = comments
        self.signedIn = signedIn
        _draft = draft
        self.posting = posting
        self.note = note
        self.noteOK = noteOK
        self.onPost = onPost
        self.onSignIn = onSignIn
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(comments.count == 1 ? "1 comment" : "\(comments.count) comments").font(.title3.bold())
            if signedIn {
                TextField("Add a comment", text: $draft, axis: .vertical)
                    .lineLimit(3...8)
                    .textFieldStyle(.roundedBorder)
                Button(posting ? "Posting…" : "Post comment", action: onPost)
                    .buttonStyle(.borderedProminent)
                    .disabled(posting || draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            } else {
                Button("Sign in to comment", action: onSignIn).buttonStyle(.bordered)
            }
            if let note {
                Text(note).font(.footnote).foregroundStyle(noteOK ? Color.secondary : Color.red)
            }
            ForEach(comments) { comment in
                CommentRow(comment: comment)
            }
        }
    }
}

/// One comment: who, when, and what they said.
public struct CommentRow: View {
    public let comment: BlogComment

    public init(comment: BlogComment) {
        self.comment = comment
    }

    public var body: some View {
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
