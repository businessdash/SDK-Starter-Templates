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

    static let fallback = HomeContext(
        configured: false,
        headline: "A business, in a box.",
        subhead: "Everything the operation needs, on your own domain.",
        aboutTitle: "About us",
        aboutBody: "Tell your story here — this copy lives in the BD dashboard once you're connected.",
        products: []
    )
}

struct ListContext: Content {
    let configured: Bool
    let posts: [BlogPost]
}

struct PostContext: Content {
    let configured: Bool
    let post: BlogPost
    let isPaywalled: Bool
}

struct ReviewsContext: Content {
    let configured: Bool
    let reviews: [Review]
}

struct PlanCard: Content {
    let id: String
    let name: String
    let price: String
}

struct PlansContext: Content {
    let configured: Bool
    let plans: [PlanCard]
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

struct StoreContext: Content {
    let configured: Bool
    let products: [ProductCard]
    let search: String
}

struct ProductContext: Content {
    let configured: Bool
    let id: String
    let name: String
    let description: String
    let price: String
    let reviews: [Review]
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
}
