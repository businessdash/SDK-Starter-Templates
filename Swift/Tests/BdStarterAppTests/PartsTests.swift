import BdStarterApp // not @testable: only what an app can reach
import BusinessDashKit
import Foundation
import SwiftUI
import Testing

// Screens laid out from the starter's parts the way an app of your own
// would. They compile only while every part they use is public, so this
// file guards the parts' API, and shows how to use them.

/// A product page of your own: photos, title, price, the option buttons,
/// stock, quantity, add to cart, details and reviews.
struct MyProductPage: View {
    let view: ProductView
    @State private var variantID: String
    @State private var chosen: [String: String] = [:]
    @State private var quantity = 1

    init(view: ProductView) {
        self.view = view
        _variantID = State(initialValue: view.defaultVariant?.id ?? "")
    }

    var body: some View {
        let price = view.price(variantID: variantID, chosen: chosen)
        let groups = view.optionGroups(for: variantID)
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                ProductGallery(urls: view.gallery(for: variantID), height: 360)
                ProductTitle(category: view.categoryName, name: view.name, rating: 4.5, reviewCount: 2)
                ProductPriceLabel(price: price, quantity: quantity)
                VariantPicker(variants: view.variants, selected: variantID, showPrices: groups.isEmpty) { id in
                    variantID = id
                    chosen = [:]
                }
                ForEach(groups) { group in
                    OptionPicker(group: group, chosen: chosen[group.id]) { chosen[group.id] = $0.id }
                }
                StockNote(stock: price.stock)
                HStack {
                    QuantityStepper(quantity: $quantity, stock: price.stock)
                    AddToCartButton(price: price, isAdding: false) {}
                }
                CartNotice(text: "Added 1 to your cart.", ok: true) {}
                ProductPolicies {}
                ProductDetails(view)
                ProductAddons(addons: []) { _ in }
                ProductReviews(reviews: nil)
                ProductRail(title: "You may also like", products: [])
            }
        }
    }
}

/// A store and cart of your own.
struct MyStore: View {
    @State private var sort = "featured"
    @State private var quantity = 1
    let products: [Product]

    var body: some View {
        VStack {
            CategoryChips(categories: [], counts: [:], selected: nil) { _ in }
            StoreResultsBar(count: products.count, filterCount: 0, sort: $sort) {}
            ForEach(products) { ProductCardView(product: $0) }
            CompareBar()
            CartSummary(subtotal: 40, currency: "USD", isCheckingOut: false) {}
        }
        .sheet(isPresented: .constant(false)) {
            StoreFiltersSheet(priceMin: "", priceMax: "", minRating: nil, priceRange: nil) { _, _, _ in } onClear: {}
        }
    }
}

/// A blog post of your own.
struct MyPost: View {
    let post: BlogPost
    @State private var draft = ""

    var body: some View {
        VStack(alignment: .leading) {
            BlogFilters(categories: [], tags: ["gear"], categoryID: nil, tag: nil, onCategory: { _ in }, onTag: { _ in })
            PostCard(post: post, lead: true)
            PostMeta(post: post, minutes: 3)
            PostBodyView(blocks: PostBlocks.from(post.content))
            PostCTA(post: post)
            PostTags(tags: post.tags)
            LikeButton(signedIn: false, likes: PostLikes(liked: false, likesCount: 2), onToggle: {}, onSignIn: {})
            PostComments(comments: [], signedIn: false, draft: $draft, onPost: {}, onSignIn: {})
            MembersOnly {}
        }
    }
}

/// The business's reviews, your way.
struct MyReviews: View {
    let summary: ReviewSummary

    var body: some View {
        VStack {
            ReviewSummaryCard(summary: summary)
            ReviewStrip(summary: summary)
            WriteReviewButton(canWrite: false, onWrite: {}, onSignIn: {})
            ReviewSourceFilter(sources: ["google", "yelp"], selected: nil) { _ in }
        }
    }
}

@MainActor
struct PartsTests {
    @Test func aProductPageOfYourOwnPicksTheFirstVariantThatCanBeBought() throws {
        let raw = try JSONDecoder().decode(JSONValue.self, from: Data("""
        {"id": "p1", "name": "Trail Shell", "variants": [
          {"id": "v1", "name": "Cloud", "price": 120, "stock": 0},
          {"id": "v2", "name": "Storm", "price": 130, "stock": 4}
        ]}
        """.utf8))
        let page = MyProductPage(view: ProductView(raw))
        #expect(page.view.defaultVariant?.id == "v2")
        #expect(page.view.price(variantID: "v2", chosen: [:]).amount == 130)
    }

    @Test func theOtherScreensOfYourOwnBuild() throws {
        let post = try JSONDecoder().decode(BlogPost.self, from: Data("""
        {"id": "b1", "slug": "first-5k-plan", "title": "Your first 5K", "content": "<p>Start slow.</p>", "tags": ["running"]}
        """.utf8))
        _ = MyStore(products: [])
        _ = MyPost(post: post)
        _ = MyReviews(summary: ReviewSummary(rating: 4.6, totalCount: 12, counts: nil))
        #expect(post.tags == ["running"])
    }
}
