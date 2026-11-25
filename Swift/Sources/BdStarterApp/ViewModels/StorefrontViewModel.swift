import BusinessDashKit
import Foundation
import Observation

/// The store list and its filters: search, category, price, rating, sort.
///
/// The filters are one value (`Filters`), and the view loads with
/// `.task(id: model.filters)`, so any change cancels the load in flight and
/// starts the next one — a fast typist doesn't stack requests or land an
/// out-of-order result.
@MainActor
@Observable
final class StorefrontViewModel: ScreenViewModel {
    var bd: BdEnvironment?

    struct Filters: Hashable, Sendable {
        var search = ""
        var categoryID: String?
        /// Dollars, as typed.
        var priceMin = ""
        var priceMax = ""
        var minRating: Int?
        var sort = "featured"

        /// Anything that narrows the list (the sort doesn't).
        var narrowed: Bool {
            !search.isEmpty || categoryID != nil || !priceMin.isEmpty || !priceMax.isEmpty || minRating != nil
        }
    }

    struct Listing: Sendable {
        let products: [Product]
        /// Products per category id.
        let counts: [String: Int]
        let priceRange: PriceRange?
    }

    var filters = Filters()
    private(set) var state: LoadState<Listing> = .loading
    private(set) var categories: [StoreCategory] = []
    /// The business's rating, for the strip that opens the reviews.
    private(set) var reviewSummary: ReviewSummary?

    func load() async {
        guard let client else {
            state = .loaded(Listing(products: [], counts: [:], priceRange: nil))
            return
        }
        if categories.isEmpty {
            categories = (try? await client.storefront.categories().categories) ?? []
        }
        if reviewSummary == nil {
            reviewSummary = try? await client.reviews.summary()
        }
        let filters = filters
        state = await LoadState {
            let grid = try await client.storefront.grid(
                search: filters.search.trimmingCharacters(in: .whitespaces),
                categoryID: filters.categoryID,
                minPriceCents: Self.cents(filters.priceMin),
                maxPriceCents: Self.cents(filters.priceMax),
                minRating: filters.minRating,
                sort: filters.sort,
                limit: 48
            )
            let counts = Dictionary(
                (grid.categoryCounts ?? []).map { ($0.categoryId, $0.count ?? 0) },
                uniquingKeysWith: { first, _ in first }
            )
            return Listing(products: grid.products, counts: counts, priceRange: grid.priceRange)
        }
    }

    /// The catalogue's prices, in dollars, once the list has loaded.
    var priceRange: PriceRange? {
        if case .loaded(let listing) = state { return listing.priceRange }
        return nil
    }

    func clearFilters() {
        filters = Filters(sort: filters.sort)
    }

    /// "12.50" → 1250; nil for anything that isn't a price.
    private static func cents(_ dollars: String) -> Int? {
        guard let value = Double(dollars.trimmingCharacters(in: .whitespaces)), value >= 0, value.isFinite else {
            return nil
        }
        return Int((value * 100).rounded())
    }
}

/// One product: its options and price, adding to the cart, add-ons, reviews
/// and the rails. The rules (which photos, what "from" means) are
/// `ProductView`'s, in BusinessDashKit.
@MainActor
@Observable
final class ProductDetailViewModel: ScreenViewModel {
    var bd: BdEnvironment?

    /// Reviews shown at first, and how many more each "Show more" adds.
    static let reviewsPage = 10

    let productID: String
    private(set) var state: LoadState<ProductView> = .loading
    private(set) var reviews: ProductReviewPage?
    private(set) var addons: [StoreAddon] = []
    private(set) var related: [SavedProduct] = []
    private(set) var recent: [SavedProduct] = []

    private(set) var variantID = ""
    private(set) var chosen: [String: String] = [:]
    var quantity = 1

    private(set) var isAdding = false
    private(set) var message: (text: String, ok: Bool)?
    private(set) var addingAddon: String?
    private(set) var addedAddons: Set<String> = []
    private var reviewLimit = reviewsPage

    init(productID: String) {
        self.productID = productID
    }

    func load() async {
        guard let client else {
            state = .failed("The store isn't connected yet.", isUnavailable: false)
            return
        }
        state = await LoadState { try await client.storefront.detail(productID) }
        guard case .loaded(let view) = state else { return }
        if variantID.isEmpty { variantID = view.defaultVariant?.id ?? "" }

        // What was viewed before this one, then this one goes first.
        if let saved = bd?.saved.recentlyViewed {
            recent = saved.items.filter { $0.id != view.id }
            saved.add(summary(view))
        }

        async let reviewPage = try? client.storefront.reviews(productID, limit: reviewLimit)
        async let addonList = try? client.storefront.addons(productID)
        async let relatedList = try? client.storefront.related(productID, limit: 6)
        let (page, addons, related) = await (reviewPage, addonList, relatedList)
        reviews = page
        self.addons = addons?.items ?? []
        self.related = (related?.items ?? []).map(SavedProduct.init)
    }

    var hasMoreReviews: Bool {
        guard let reviews else { return false }
        return reviews.totalCount > reviews.items.count
    }

    func moreReviews() async {
        guard let client else { return }
        reviewLimit += Self.reviewsPage
        if let page = try? await client.storefront.reviews(productID, limit: min(reviewLimit, 100)) {
            reviews = page
        }
    }

    // MARK: Choosing

    func select(variant id: String) {
        guard id != variantID else { return }
        variantID = id
        chosen = [:]
        quantity = 1
        message = nil
    }

    func choose(_ value: OptionValue, in group: OptionGroup) {
        chosen[group.id] = value.id
        message = nil
        // Never more than there is.
        if case .loaded(let view) = state, let stock = view.price(variantID: variantID, chosen: chosen).stock, stock > 0 {
            quantity = min(quantity, stock)
        }
    }

    // MARK: Adding

    func add(_ view: ProductView) async {
        guard let cart = bd?.cart else { return }
        isAdding = true
        defer { isAdding = false }
        do {
            let snapshot = try await cart.add(CartAddItemInput(
                productId: view.id,
                variantId: variantID.isEmpty ? nil : variantID,
                quantity: quantity,
                options: view.chosenOptions(variantID: variantID, chosen: chosen)
            ))
            bd?.noteCart(snapshot)
            message = ("Added \(quantity) to your cart.", true)
        } catch {
            message = ((error as? BdError)?.errorDescription ?? "Couldn't add that to your cart. Try again.", false)
        }
    }

    /// An add-on goes in as one of its first variant.
    func add(_ addon: StoreAddon) async {
        guard let cart = bd?.cart else { return }
        addingAddon = addon.id
        defer { addingAddon = nil }
        do {
            let snapshot = try await cart.add(CartAddItemInput(
                productId: addon.addonProductId, variantId: addon.firstVariantID, quantity: 1
            ))
            bd?.noteCart(snapshot)
            addedAddons.insert(addon.id)
        } catch {
            message = ((error as? BdError)?.errorDescription ?? "Couldn't add that to your cart. Try again.", false)
        }
    }

    /// What the saved lists keep of this product.
    func summary(_ view: ProductView) -> SavedProduct {
        let price = view.defaultVariant?.price
        return SavedProduct(
            id: view.id,
            name: view.name,
            image: view.gallery(for: variantID).first,
            priceCents: price.map { Int(($0 * 100).rounded()) }
        )
    }
}

/// Up to four products side by side: each one's page data and rating.
@MainActor
@Observable
final class CompareViewModel: ScreenViewModel {
    var bd: BdEnvironment?

    struct Column: Sendable, Identifiable {
        let view: ProductView
        let rating: (avg: Double, count: Int)?
        var id: String { view.id }
    }

    private(set) var state: LoadState<[Column]> = .loading

    func load(ids: [String]) async {
        guard let client else {
            state = .loaded([])
            return
        }
        state = await LoadState {
            var columns: [Column] = []
            for id in ids.prefix(4) {
                guard let view = try? await client.storefront.detail(id) else { continue }
                let reviews = try? await client.storefront.reviews(id, limit: 1)
                columns.append(Column(
                    view: view,
                    rating: reviews.flatMap { $0.totalCount > 0 ? ($0.avgRating, $0.totalCount) : nil }
                ))
            }
            return columns
        }
    }
}
