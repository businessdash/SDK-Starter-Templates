import Vapor

/// The product page's parts, worked out for the templates in
/// Resources/Views/shop/ (Leaf can't call methods, so every label, link and
/// flag a part shows is here). Each part reads its own piece: the gallery
/// reads `detail.gallery`, the price `detail.price`, and so on.
///
/// It's the page as it opens (the first variant that can be bought, nothing
/// else chosen; the rules are `Shop`). `<bd-gallery>` and `<bd-product-form>`
/// (Public/shop/shop-elements.js) bring the parts to life: they find them by
/// their `data-bd-*` attributes, so move, restyle or drop any part, or lay
/// them out your own way.
struct ProductDetail: Content {
    struct Breadcrumbs: Content {
        let hasCategory: Bool
        let categoryHref: String
        let categoryName: String
        let name: String
    }

    struct Photo: Content {
        let src: String
        let index: Int
        let label: String
        let current: Bool
    }

    struct PhotoSet: Content {
        let variantId: String
        let hidden: Bool
        let hasPhotos: Bool
        let main: String
        let many: Bool
        let photos: [Photo]
    }

    struct Gallery: Content {
        let productId: String
        let name: String
        let sets: [PhotoSet]
    }

    struct Title: Content {
        let hasCategory: Bool
        let categoryName: String
        let name: String
        let hasRating: Bool
        let starsHTML: String
        let ratingLabel: String
    }

    struct Price: Content {
        let fromHidden: Bool
        let amount: String
        let eachHidden: Bool
        let each: String
    }

    struct VariantButton: Content {
        let id: String
        let name: String
        let pressed: Bool
        let disabled: Bool
        let hasPrice: Bool
        let price: String
    }

    struct OptionButton: Content {
        let id: String
        let value: String
        let disabled: Bool
    }

    struct OptionGroup: Content {
        let id: String
        let title: String
        let hasForVariant: Bool
        let forVariant: String
        let hidden: Bool
        let values: [OptionButton]
    }

    struct Stock: Content {
        let hidden: Bool
        let text: String
    }

    struct Quantity: Content {
        let value: Int
        let minusDisabled: Bool
        let plusDisabled: Bool
    }

    struct AddButton: Content {
        let disabled: Bool
        let label: String
    }

    struct Addon: Content {
        let name: String
        let image: String
        let hasImage: Bool
        let group: String
        let hasGroup: Bool
        let price: String
        let hasPrice: Bool
        let productId: String
        let variantId: String
        let hasVariant: Bool
    }

    struct Review: Content {
        let starsHTML: String
        let name: String
        let date: String
        let title: String
        let hasTitle: Bool
        let body: String
        let hasBody: Bool
    }

    struct Reviews: Content {
        let hasReviews: Bool
        let starsHTML: String
        let average: String
        let total: Int
        let items: [Review]
        let hasMore: Bool
        let moreHref: String
    }

    struct RailCard: Content {
        let href: String
        let name: String
        let image: String
        let hasImage: Bool
        let price: String
        let hasPrice: Bool
    }

    let storeHref: String
    let cartHref: String
    let addURL: String
    let contactHref: String
    let breadcrumbs: Breadcrumbs
    let gallery: Gallery
    let title: Title
    /// `{product}` for `<bd-product-form>`.
    let formJSON: String
    let price: Price
    let description: String
    let hasDescription: Bool
    let hasVariants: Bool
    let showVariantPrices: Bool
    let variants: [VariantButton]
    let groups: [OptionGroup]
    let stock: Stock
    let quantity: Quantity
    let add: AddButton
    /// `{id, name, image, priceCents}` for the save buttons and recently viewed.
    let summaryJSON: String
    let features: [String]
    let hasFeatures: Bool
    let specs: [Shop.SpecGroup]
    let hasDetails: Bool
    let addons: [Addon]
    let hasAddons: Bool
    let reviews: Reviews
    let related: [RailCard]
    let hasRelated: Bool

    init(
        product: JSONValue,
        reviews reviewPage: JSONValue?,
        addons: [JSONValue],
        related: [JSONValue],
        moreReviewsHref: String?,
        storeHref: String = "/store",
        cartHref: String = "/cart",
        addURL: String = "/api/bd/cart/add",
        contactHref: String = "/#contact"
    ) {
        let view = Shop.productView(product)
        let variantId = Shop.defaultVariant(view)?.id ?? ""
        let price = Shop.priceFor(view, variantId)
        let quantity = 1

        self.storeHref = storeHref
        self.cartHref = cartHref
        self.addURL = addURL
        self.contactHref = contactHref

        breadcrumbs = Breadcrumbs(
            hasCategory: view.categoryId != nil,
            categoryHref: "\(storeHref)?category=\((view.categoryId ?? "").queryEscaped)",
            categoryName: view.categoryName ?? "Category",
            name: view.name
        )

        let sets = Shop.photoSets(view)
        let shown = sets.contains { $0.variantId == variantId } ? variantId : ""
        gallery = Gallery(productId: view.id, name: view.name, sets: sets.map { set in
            PhotoSet(
                variantId: set.variantId,
                hidden: set.variantId != shown,
                hasPhotos: !set.photos.isEmpty,
                main: set.photos.first ?? "",
                many: set.photos.count > 1,
                photos: set.photos.enumerated().map { i, src in
                    Photo(src: src, index: i, label: "Photo \(i + 1) of \(set.photos.count)", current: i == 0)
                }
            )
        })

        let total = reviewPage?["totalCount"]?.intValue ?? 0
        let average = reviewPage?["avgRating"].flatMap { if case .number(let n) = $0 { return n } else { return nil } } ?? 0
        title = Title(
            hasCategory: view.categoryName != nil,
            categoryName: view.categoryName ?? "",
            name: view.name,
            hasRating: total > 0,
            starsHTML: Stars.html(average),
            ratingLabel: "\(String(format: "%.1f", average)) · \(total) reviews"
        )

        formJSON = ElementData.json(JSONValue.object(["product": product]))
        self.price = Price(
            fromHidden: !(price.amount != nil && price.from),
            amount: price.amount.map { Money.amount($0 * Double(quantity)) } ?? "Sold out",
            eachHidden: !(price.amount != nil && quantity > 1),
            each: price.amount.map { quantity > 1 ? " (\(Money.amount($0)) each)" : "" } ?? ""
        )
        description = view.description
        hasDescription = !view.description.isEmpty

        hasVariants = view.variants.count > 1
        showVariantPrices = Shop.optionGroupsFor(view, variantId).isEmpty
        variants = view.variants.map { v in
            VariantButton(
                id: v.id, name: v.name, pressed: v.id == variantId, disabled: !v.available,
                hasPrice: v.price != nil, price: v.price.map { Money.amount($0) } ?? ""
            )
        }
        groups = Shop.allOptionGroups(view).map { group in
            OptionGroup(
                id: group.id,
                title: group.title,
                hasForVariant: group.variantId != nil,
                forVariant: group.variantId ?? "",
                hidden: group.variantId != nil && group.variantId != variantId,
                values: group.values.map { OptionButton(id: $0.id, value: $0.value, disabled: !$0.available) }
            )
        }

        let low = price.stock.map { $0 > 0 && $0 <= 5 } ?? false
        stock = Stock(hidden: !low, text: low ? "Only \(Self.count(price.stock ?? 0)) left" : "")
        self.quantity = Quantity(
            value: quantity,
            minusDisabled: quantity <= 1,
            plusDisabled: price.stock.map { Double(quantity) >= $0 } ?? false
        )
        add = AddButton(
            disabled: !price.ready,
            label: price.amount == nil ? "Sold out" : !price.ready ? "Choose options" : "Add to cart"
        )
        summaryJSON = ElementData.json(Shop.productSummary(view, variantId))

        features = view.features
        hasFeatures = !view.features.isEmpty
        specs = view.specs
        hasDetails = !view.features.isEmpty || !view.specs.isEmpty

        self.addons = addons.map { addon in
            let name = addon["addonName"]?.stringValue ?? ""
            let image = addon["imageUrl"]?.stringValue ?? ""
            let group = addon["groupLabel"]?.stringValue ?? ""
            let cents = addon["priceCents"]?.intValue
            let variant = Shop.addonVariant(addon)
            return Addon(
                name: name, image: image, hasImage: !image.isEmpty, group: group, hasGroup: !group.isEmpty,
                price: Money.cents(cents), hasPrice: cents != nil,
                productId: addon["addonProductId"]?.stringValue ?? "",
                variantId: variant ?? "", hasVariant: variant != nil
            )
        }
        hasAddons = !addons.isEmpty

        let items = reviewPage?["items"]?.arrayValue ?? []
        self.reviews = Reviews(
            hasReviews: !items.isEmpty,
            starsHTML: Stars.html(average),
            average: String(format: "%.1f", average),
            total: total,
            items: items.map { review in
                let rating = review["rating"].flatMap { if case .number(let n) = $0 { return n } else { return nil } } ?? 0
                let title = review["title"]?.stringValue ?? ""
                let body = review["content"]?.stringValue ?? review["body"]?.stringValue ?? ""
                return Review(
                    starsHTML: Stars.html(rating),
                    name: review["reviewerName"]?.stringValue ?? "Verified buyer",
                    date: Shop.reviewDate(review["createdAt"]?.stringValue),
                    title: title, hasTitle: !title.isEmpty,
                    body: body, hasBody: !body.isEmpty
                )
            },
            hasMore: moreReviewsHref != nil,
            moreHref: moreReviewsHref ?? ""
        )

        self.related = related.map { item in
            let id = item["id"]?.stringValue ?? ""
            let image = item["coverImageUrl"]?.stringValue ?? ""
            let cents = item["minPriceDollars"].flatMap { value -> Int? in
                if case .number(let n) = value, n.isFinite { return Int((n * 100).rounded()) }
                return nil
            }
            return RailCard(
                href: "\(storeHref)/\(id.pathEscaped)",
                name: item["name"]?.stringValue ?? "",
                image: image, hasImage: !image.isEmpty,
                price: Money.cents(cents), hasPrice: cents != nil
            )
        }
        hasRelated = !related.isEmpty
    }

    /// A stock count as JavaScript prints it: 3, not 3.0.
    private static func count(_ n: Double) -> String {
        n == n.rounded() ? String(Int(n)) : String(n)
    }
}
