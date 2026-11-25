import Vapor

// View contexts. Leaf can't call methods, so anything derived — formatted
// money especially — is computed here rather than in the template. That also
// keeps the cents-vs-decimal decision in Swift, where the type system helps.

struct ProductCard: Content {
    let id: String
    let name: String
    let blurb: String
    let price: String

    init(_ product: Product) {
        self.id = product.id
        self.name = product.name
        self.blurb = product.description ?? ""
        // Integer cents. A card carries no currency — the cart does.
        self.price = Money.cents(product.cheapestPriceCents)
    }
}

struct HomeContext: Content {
    let configured: Bool
    let headline: String
    let subhead: String
    let aboutTitle: String
    let aboutBody: String
    let products: [ProductCard]
    /// The contact section's form, rendered by `FormPage`.
    var contactForm = ""

    static let fallback = HomeContext(
        configured: false,
        headline: "A business, in a box.",
        subhead: "Everything the operation needs, on your own domain.",
        aboutTitle: "About us",
        aboutBody: "Tell your story here — this copy lives in the BD dashboard once you're connected.",
        products: []
    )
}

/// The reviews page, every figure, word and link worked out here so the
/// template only places them.
struct ReviewsContext: Content {
    let configured: Bool
    let hasAverage: Bool
    let average: String
    let averageStars: String
    let totalLabel: String
    let bars: [ReviewBar]
    /// `{ signedIn }` for <bd-review-writer>.
    let writerJSON: String
    let showFilter: Bool
    let chips: [ReviewChip]
    let cards: [ReviewCard]
    let emptyMessage: String
    let hasMore: Bool
    let moreHref: String

    static let notConnected = ReviewsContext(
        configured: false, hasAverage: false, average: "", averageStars: "", totalLabel: "", bars: [],
        writerJSON: "null", showFilter: false, chips: [], cards: [], emptyMessage: "", hasMore: false, moreHref: ""
    )

    init(
        configured: Bool, hasAverage: Bool, average: String, averageStars: String, totalLabel: String,
        bars: [ReviewBar], writerJSON: String, showFilter: Bool, chips: [ReviewChip], cards: [ReviewCard],
        emptyMessage: String, hasMore: Bool, moreHref: String
    ) {
        self.configured = configured
        self.hasAverage = hasAverage
        self.average = average
        self.averageStars = averageStars
        self.totalLabel = totalLabel
        self.bars = bars
        self.writerJSON = writerJSON
        self.showFilter = showFilter
        self.chips = chips
        self.cards = cards
        self.emptyMessage = emptyMessage
        self.hasMore = hasMore
        self.moreHref = moreHref
    }

    init(summary: Reviews.Summary, signedIn: Bool, sources: [String], source: String?, reviews: [Review], moreHref: String?) {
        let average = summary.average.map { String(format: "%.1f", $0) } ?? ""
        self.init(
            configured: true,
            hasAverage: summary.average != nil,
            average: average,
            averageStars: Reviews.stars(summary.average),
            totalLabel: "\(summary.total) \(summary.total == 1 ? "review" : "reviews")",
            bars: summary.histogram.map {
                ReviewBar(stars: $0.stars, count: $0.count, width: "width: \(Int(($0.share * 100).rounded()))%")
            },
            writerJSON: ElementData.json(["signedIn": signedIn]),
            showFilter: sources.count > 1,
            chips: [ReviewChip(label: "All", href: "/reviews", current: source == nil ? "true" : "false")]
                + sources.map {
                    ReviewChip(label: Reviews.sourceLabel($0), href: "/reviews?source=\($0)", current: source == $0 ? "true" : "false")
                },
            cards: reviews.enumerated().map { ReviewCard(review: $0.element, index: $0.offset) },
            emptyMessage: source.map { "No \(Reviews.sourceLabel($0)) reviews yet." }
                ?? "No reviews yet. Connect Google or Yelp in BusinessDash, or add reviews in the dashboard, and they'll appear here.",
            hasMore: moreHref != nil,
            moreHref: moreHref ?? ""
        )
    }
}

struct ReviewBar: Content {
    let stars: Int
    let count: Int
    /// `width: 57%`, for the bar's fill.
    let width: String
}

/// A platform filter link; `current` is "true" on the one showing.
struct ReviewChip: Content {
    let label: String
    let href: String
    let current: String
}

struct ReviewCard: Content {
    let anchor: String
    let hasAvatar: Bool
    let avatar: String
    let initial: String
    let name: String
    let stars: String
    let ratingLabel: String
    let date: String
    let text: String
    let photos: [String]
    let hasPhotos: Bool
    let hasFoot: Bool
    let hasPlatform: Bool
    let platform: String
    let verified: Bool
    let hasLink: Bool
    let link: String

    init(review: Review, index: Int) {
        let avatar = Reviews.webURL(review.reviewerImageUrl)
        let platform = Reviews.platformName(review.source)
        let link = Reviews.link(review)
        let photos = (review.photos ?? []).compactMap(Reviews.webURL)
        let verified = review.verified == true
        anchor = "review-\(index)"
        hasAvatar = avatar != nil
        self.avatar = avatar ?? ""
        initial = Reviews.initial(review)
        name = Reviews.reviewerName(review)
        stars = Reviews.stars(review.rating)
        ratingLabel = "\(Int(review.rating.rounded())) out of 5"
        date = Reviews.date(review.timeCreated)
        text = review.text ?? ""
        self.photos = photos
        hasPhotos = !photos.isEmpty
        hasFoot = platform != nil || verified
        hasPlatform = platform != nil
        self.platform = platform ?? ""
        self.verified = verified
        hasLink = link != nil && platform != nil
        self.link = link ?? ""
    }
}

struct PlanCard: Content {
    let id: String
    let name: String
    let price: String
}

struct PlansContext: Content {
    let configured: Bool
    let plans: [PlanCard]
    /// For the store bar.
    var cartCount = 0
}

struct TodoRow: Content {
    let title: String
    let notes: String
    let done: Bool
}

struct TodosContext: Content {
    let configured: Bool
    let todos: [TodoRow]
}

struct ServiceRow: Content {
    let service: String
    let area: String
    let label: String
}

struct ServicesContext: Content {
    let configured: Bool
    let variants: [ServiceRow]
}

struct ServiceAreaContext: Content {
    let configured: Bool
    let heading: String
    let html: String
}

struct CartLine: Content {
    let id: String
    let name: String
    let quantity: Int
    let unitPrice: String
}

struct CartContext: Content {
    let configured: Bool
    let lines: [CartLine]
    let subtotal: String
    let isEmpty: Bool
    /// For the store bar.
    let cartCount: Int
}
