import BusinessDashKit
import SwiftUI

/// The business's reviews from Google, Yelp and the dashboard: the rating
/// over all of them with a stars breakdown, a platform filter, each review
/// with its photos and a link to it on its own site, more on demand, and
/// writing one when signed in.
///
/// It's laid out from parts: `ReviewSummaryCard`, `WriteReviewButton`,
/// `ReviewSourceFilter`, a `ReviewRow` per review, and `ReviewWriter`.
public struct ReviewsView: View {
    @Environment(BdEnvironment.self) private var bd
    @State private var model = ReviewsViewModel()
    @State private var writing = false

    public init() {}

    public var body: some View {
        LoadableView(state: model.state) { page in
            List {
                Section {
                    if let summary = model.summary, summary.rating != nil {
                        ReviewSummaryCard(summary: summary)
                    }
                    WriteReviewButton(
                        canWrite: bd.portal != nil,
                        onWrite: { writing = true },
                        onSignIn: { bd.tab = .account }
                    )
                }
                if model.sources.count > 1 {
                    Section {
                        ReviewSourceFilter(sources: model.sources, selected: model.source) { model.source = $0 }
                    }
                }
                Section {
                    if page.reviews.isEmpty {
                        Text(model.source == nil
                             ? "No reviews yet. Connect Google or Yelp in BD, or add reviews in the dashboard, and they'll appear here."
                             : "No \(ReviewSource.label(model.source)) reviews yet.")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(page.reviews) { review in
                        ReviewRow(review: review)
                    }
                    if page.nextOffset != nil {
                        Button(model.loadingMore ? "Loading…" : "Show more reviews") {
                            Task { await model.loadMore() }
                        }
                        .disabled(model.loadingMore)
                    }
                } header: {
                    if model.source != nil {
                        Text("\(page.total) \(ReviewSource.label(model.source)) \(page.total == 1 ? "review" : "reviews")")
                    }
                }
            }
        }
        .navigationTitle("Reviews")
        .sheet(isPresented: $writing) {
            ReviewWriter()
        }
        .task(id: model.source) {
            model.bind(bd)
            await model.load()
        }
        .refreshable { await model.load() }
    }
}

/// Write a review; signed out, Sign in to write a review.
public struct WriteReviewButton: View {
    public let canWrite: Bool
    public let onWrite: () -> Void
    public let onSignIn: () -> Void

    public init(canWrite: Bool, onWrite: @escaping () -> Void, onSignIn: @escaping () -> Void) {
        self.canWrite = canWrite
        self.onWrite = onWrite
        self.onSignIn = onSignIn
    }

    public var body: some View {
        if canWrite {
            Button(action: onWrite) {
                Label("Write a review", systemImage: "square.and.pencil")
            }
        } else {
            Button(action: onSignIn) {
                Label("Sign in to write a review", systemImage: "person.crop.circle")
            }
        }
    }
}

/// All, then a chip per platform (Google, Yelp…).
public struct ReviewSourceFilter: View {
    public let sources: [String]
    public let selected: String?
    public let onSelect: (String?) -> Void

    public init(sources: [String], selected: String?, onSelect: @escaping (String?) -> Void) {
        self.sources = sources
        self.selected = selected
        self.onSelect = onSelect
    }

    public var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                chip("All", on: selected == nil) { onSelect(nil) }
                ForEach(sources, id: \.self) { source in
                    chip(ReviewSource.label(source), on: selected == source) { onSelect(source) }
                }
            }
        }
    }

    private func chip(_ title: String, on: Bool, action: @escaping () -> Void) -> some View {
        Button(title, action: action)
            .buttonStyle(.bordered)
            .buttonBorderShape(.capsule)
            .tint(on ? .accentColor : .secondary)
            .accessibilityAddTraits(on ? .isSelected : [])
    }
}

/// The average, the count, and a bar for each star.
public struct ReviewSummaryCard: View {
    public let summary: ReviewSummary

    public init(summary: ReviewSummary) {
        self.summary = summary
    }

    public var body: some View {
        HStack(alignment: .center, spacing: 20) {
            VStack(spacing: 4) {
                Text(String(format: "%.1f", summary.rating ?? 0))
                    .font(.system(size: 44, weight: .bold, design: .rounded))
                StarRating(rating: summary.rating ?? 0, size: 13)
                if let total = summary.totalCount {
                    Text("\(total) \(total == 1 ? "review" : "reviews")").font(.caption).foregroundStyle(.secondary)
                }
            }
            if summary.counts?.isEmpty == false {
                VStack(spacing: 4) {
                    ForEach(summary.histogram, id: \.stars) { row in
                        HStack(spacing: 6) {
                            Text("\(row.stars)").font(.caption2.monospacedDigit()).frame(width: 10)
                            ProgressView(value: row.share)
                                .tint(.orange)
                            Text("\(row.count)").font(.caption2.monospacedDigit()).foregroundStyle(.secondary)
                                .frame(minWidth: 18, alignment: .trailing)
                        }
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("\(row.stars) stars: \(row.count) \(row.count == 1 ? "review" : "reviews")")
                    }
                }
            }
        }
        .padding(.vertical, 6)
    }
}

/// One review: who, the stars, when, where it was posted, the words, the
/// reviewer's photos, and a link to it on its own site.
public struct ReviewRow: View {
    public let review: Review

    public init(review: Review) {
        self.review = review
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                avatar
                VStack(alignment: .leading, spacing: 2) {
                    Text(name).font(.subheadline.weight(.semibold))
                    HStack(spacing: 6) {
                        StarRating(rating: review.rating, size: 10)
                        Text(PostHtml.date(review.timeCreated)).font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
            if let text = review.text, !text.isEmpty {
                Text(text).font(.subheadline)
            }
            if let photos = review.photos, !photos.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(photos, id: \.self) { photo in
                            RemoteImage(url: photo)
                                .frame(width: 72, height: 72)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                    }
                }
                .accessibilityLabel("\(photos.count) \(photos.count == 1 ? "photo" : "photos") from the reviewer")
            }
            HStack(spacing: 8) {
                if let platform = ReviewSource.platform(review.source) {
                    Text(platform).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                }
                if review.verified == true {
                    // An HStack, not a Label: a List row gives a Label's icon
                    // a column of its own.
                    HStack(spacing: 3) {
                        Image(systemName: "checkmark.seal.fill")
                        Text("Verified")
                    }
                    .font(.caption)
                    .foregroundStyle(.green)
                }
                Spacer()
                if let link, let platform = ReviewSource.platform(review.source) {
                    Link("Read on \(platform)", destination: link).font(.caption)
                }
            }
        }
        .padding(.vertical, 4)
    }

    private var name: String {
        let trimmed = (review.reviewerName ?? "").trimmingCharacters(in: .whitespaces)
        return trimmed.isEmpty ? "Anonymous" : trimmed
    }

    /// Web links only.
    private var link: URL? {
        guard let raw = review.reviewUrl, let url = URL(string: raw),
              ["http", "https"].contains(url.scheme?.lowercased() ?? "") else { return nil }
        return url
    }

    @ViewBuilder private var avatar: some View {
        if let image = review.reviewerImageUrl, !image.isEmpty {
            RemoteImage(url: image).frame(width: 34, height: 34).clipShape(Circle())
        } else {
            Text(String(name.prefix(1)).uppercased())
                .font(.subheadline.weight(.semibold))
                .frame(width: 34, height: 34)
                .background(Color.accentColor.opacity(0.15), in: Circle())
                .foregroundStyle(Color.accentColor)
        }
    }
}

/// Stars, a title and the review, sent for the business to approve.
public struct ReviewWriter: View {
    @Environment(BdEnvironment.self) private var bd
    @Environment(\.dismiss) private var dismiss
    @State private var model = ReviewWriterModel()

    public init() {}

    public var body: some View {
        @Bindable var model = model
        NavigationStack {
            Form {
                if model.sent {
                    Section {
                        Label("Thanks! Your review shows once it's approved.", systemImage: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                    }
                } else {
                    Section("Your rating") {
                        HStack(spacing: 10) {
                            ForEach(1...5, id: \.self) { star in
                                Button {
                                    model.rating = star
                                } label: {
                                    Image(systemName: star <= model.rating ? "star.fill" : "star")
                                        .font(.title2)
                                        .foregroundStyle(.orange)
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel("\(star) \(star == 1 ? "star" : "stars")")
                                .accessibilityAddTraits(star == model.rating ? .isSelected : [])
                            }
                        }
                    }
                    Section {
                        TextField("Title (optional)", text: $model.title)
                        TextField("What was it like?", text: $model.text, axis: .vertical)
                            .lineLimit(4...10)
                    } footer: {
                        if model.text.count > ReviewWriterModel.maxLength {
                            Text("Reviews are up to 5,000 characters.").foregroundStyle(.red)
                        }
                    }
                    if let error = model.error {
                        Section { Text(error).foregroundStyle(.red) }
                    }
                }
            }
            .navigationTitle("Write a review")
            .toolbar {
                if model.sent {
                    ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
                } else {
                    ToolbarItem(placement: .confirmationAction) {
                        Button(model.sending ? "Sending…" : "Send") {
                            Task { await model.send(with: bd.portal) }
                        }
                        .disabled(!model.canSend)
                    }
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                }
            }
        }
    }
}

/// "★ 4.6 · 128 reviews ›" at the top of the store, opening the reviews.
public struct ReviewStrip: View {
    public let summary: ReviewSummary

    public init(summary: ReviewSummary) {
        self.summary = summary
    }

    public var body: some View {
        if let rating = summary.rating, let total = summary.totalCount, total > 0 {
            NavigationLink {
                ReviewsView()
            } label: {
                HStack(spacing: 8) {
                    StarRating(rating: rating, size: 12)
                    Text(String(format: "%.1f", rating)).font(.subheadline.weight(.semibold))
                    Text("· \(total) \(total == 1 ? "review" : "reviews")").font(.subheadline).foregroundStyle(.secondary)
                    Spacer()
                    Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(.tertiary)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 12))
            }
            .buttonStyle(.plain)
            .accessibilityLabel(String(format: "Rated %.1f from %d reviews. See all reviews.", rating, total))
        }
    }
}
