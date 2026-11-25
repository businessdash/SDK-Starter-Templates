import BusinessDashKit
import Foundation
import Observation

/// What a saved list keeps of a product: enough to draw a card without a fetch.
public struct SavedProduct: Codable, Sendable, Identifiable, Equatable {
    public let id: String
    public let name: String
    public let image: String?
    /// **Integer cents.**
    public let priceCents: Int?

    public init(id: String, name: String, image: String?, priceCents: Int?) {
        self.id = id
        self.name = name
        self.image = image
        self.priceCents = priceCents
    }

    init(_ card: Product) {
        self.init(id: card.id, name: card.name, image: card.coverImage, priceCents: card.cheapestPriceCents)
    }

    init(_ related: RelatedProduct) {
        self.init(
            id: related.id,
            name: related.name,
            image: related.coverImageUrl,
            priceCents: related.minPriceDollars.map { Int(($0 * 100).rounded()) }
        )
    }
}

/// A list kept on this device, in `UserDefaults`, as the web starters keep it
/// in the browser. Nothing reaches BD: a wishlist that follows a signed-in
/// customer between devices would need a table of its own.
@MainActor
@Observable
public final class SavedList {
    public let limit: Int
    public private(set) var items: [SavedProduct]
    private let key: String
    private let defaults: UserDefaults

    init(key: String, limit: Int, defaults: UserDefaults = .standard) {
        self.key = key
        self.limit = limit
        self.defaults = defaults
        self.items = defaults.data(forKey: key)
            .flatMap { try? JSONDecoder().decode([SavedProduct].self, from: $0) } ?? []
    }

    public func contains(_ id: String) -> Bool { items.contains { $0.id == id } }

    public var isFull: Bool { items.count >= limit }

    /// Adds or removes; false when it's full and so wasn't added.
    @discardableResult
    public func toggle(_ product: SavedProduct) -> Bool {
        if contains(product.id) {
            remove(product.id)
            return true
        }
        guard !isFull else { return false }
        write(items + [product])
        return true
    }

    /// Puts it first (recently viewed), dropping the oldest past the limit.
    public func add(_ product: SavedProduct) {
        write([product] + items.filter { $0.id != product.id })
    }

    public func remove(_ id: String) { write(items.filter { $0.id != id }) }

    public func clear() { write([]) }

    private func write(_ next: [SavedProduct]) {
        items = Array(next.prefix(limit))
        defaults.set(try? JSONEncoder().encode(items), forKey: key)
    }
}

/// The three lists the store uses.
@MainActor
public final class SavedLists {
    public let wishlist = SavedList(key: "bd:wishlist", limit: 60)
    /// The compare table fits four.
    public let compare = SavedList(key: "bd:compare", limit: 4)
    public let recentlyViewed = SavedList(key: "bd:recently-viewed", limit: 12)
}
