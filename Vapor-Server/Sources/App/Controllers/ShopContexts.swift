import Vapor

// View contexts for the store and blog pages. As in Contexts.swift, Leaf
// can't call methods, so every link, label and flag a template shows is
// worked out here.

/// A hidden field a filter form carries along, so it changes one filter and
/// keeps the rest.
struct HiddenField: Content {
    let name: String
    let value: String
}

struct FacetLink: Content {
    let label: String
    let href: String
    let productCount: Int
    let active: Bool
}

struct RatingLink: Content {
    let starsHTML: String
    let href: String
    let active: Bool
}

struct SortOption: Content {
    let value: String
    let label: String
    let selected: Bool
}

struct StoreCard: Content {
    let href: String
    let name: String
    let image: String
    let hasImage: Bool
    let isBestSeller: Bool
    let isNew: Bool
    let isOnSale: Bool
    let hasReviews: Bool
    let starsHTML: String
    let reviewCount: Int
    let price: String
    let compare: String
    let hasCompare: Bool
    let isLowStock: Bool
    /// `{id, name, image, priceCents}` for `<bd-save-buttons>`.
    let saveData: String
}

struct StoreListContext: Content {
    let configured: Bool
    let cartCount: Int
    /// BD didn't answer: the list can't be shown.
    let unavailable: Bool
    let search: String
    let priceMin: String
    let priceMax: String
    let priceMinPlaceholder: String
    let priceMaxPlaceholder: String
    let keepForSearch: [HiddenField]
    let keepForPrice: [HiddenField]
    let keepForSort: [HiddenField]
    let allHref: String
    let allActive: Bool
    let categories: [FacetLink]
    let hasCategories: Bool
    let ratings: [RatingLink]
    let hasFilters: Bool
    let countLabel: String
    let sorts: [SortOption]
    let products: [StoreCard]
    let isEmpty: Bool
}

struct ProductPageContext: Content {
    let configured: Bool
    let cartCount: Int
    let title: String
    let unavailable: Bool
    let found: Bool
    let notFound: Bool
    /// The page's parts (ProductDetail.swift); nil when there's no product.
    let detail: ProductDetail?
}

struct WishlistContext: Content {
    let configured: Bool
    let cartCount: Int
}

struct CompareContext: Content {
    let configured: Bool
    let cartCount: Int
    /// `{ids, columns: [{product, rating}]}` for `<bd-compare>`.
    let dataJSON: String
}

struct OrderContext: Content {
    let configured: Bool
    let cartCount: Int
    let paid: Bool
    let email: String
    let hasEmail: Bool
}

struct FilterLink: Content {
    let label: String
    let href: String
    let current: Bool
}

struct PostCard: Content {
    let href: String
    let title: String
    let image: String
    let hasImage: Bool
    let pinned: Bool
    let date: String
    let minutes: Int
    let excerpt: String
    let hasExcerpt: Bool
    let author: String
    let hasAuthor: Bool
    /// The first post on the first page is drawn larger.
    let lead: Bool
}

struct BlogListContext: Content {
    let configured: Bool
    let title: String
    let heading: String
    let description: String
    let hasDescription: Bool
    let hasFilterNav: Bool
    let categories: [FilterLink]
    let hasCategories: Bool
    let tags: [FilterLink]
    let hasTags: Bool
    let posts: [PostCard]
    let isEmpty: Bool
    let filtered: Bool
    let olderHref: String
    let hasOlder: Bool
}

struct TagLink: Content {
    let label: String
    let href: String
}

struct PostPageContext: Content {
    let configured: Bool
    let found: Bool
    /// The page's <title>, and the post's own heading.
    let title: String
    let heading: String
    let author: String
    let hasAuthor: Bool
    let avatar: String
    let hasAvatar: Bool
    let date: String
    let minutes: Int
    let image: String
    let hasImage: Bool
    let paywalled: Bool
    /// Rebuilt from an allowlist by `PostHtml.safe(_:)`; safe for `#unsafeHTML`.
    let html: String
    let hasCTA: Bool
    let ctaHref: String
    let ctaLabel: String
    let ctaDescription: String
    let hasCTADescription: Bool
    let tags: [TagLink]
    let hasTags: Bool
    let signInHref: String
    let likeURL: String
    let commentURL: String
    let likesJSON: String
    let commentsJSON: String

    static func notFound(configured: Bool) -> PostPageContext {
        PostPageContext(
            configured: configured, found: false, title: "Post not found", heading: "", author: "", hasAuthor: false,
            avatar: "", hasAvatar: false, date: "", minutes: 0, image: "", hasImage: false, paywalled: false,
            html: "", hasCTA: false, ctaHref: "", ctaLabel: "", ctaDescription: "", hasCTADescription: false,
            tags: [], hasTags: false, signInHref: "", likeURL: "", commentURL: "", likesJSON: "null",
            commentsJSON: "null"
        )
    }
}

/// A query string from ordered pairs, leaving out empty values.
func queryString(_ pairs: [(String, String?)]) -> String {
    let items = pairs.compactMap { key, value -> String? in
        guard let value, !value.isEmpty else { return nil }
        return "\(key.queryEscaped)=\(value.queryEscaped)"
    }
    return items.isEmpty ? "" : "?" + items.joined(separator: "&")
}
