// Nearly every field is nullable on purpose. The platform returns a superset
// that grows release to release, and an app that hard-fails parsing because a
// new nullable column appeared is an app that breaks on somebody else's
// deploy. Nullable + a sensible default beats a strict model.

/// A product **card** — what the storefront grid returns.
///
/// The field names are the platform's, not the obvious ones: the price is
/// `cheapestPriceCents` (a product can have variants, so there is no single
/// price), the image is `coverImage`, and a card carries no `currency` at all
/// — the cart does.
class Product {
  const Product({
    required this.id,
    required this.name,
    this.description,
    this.categoryId,
    this.cheapestPriceCents,
    this.comparePriceCents,
    this.coverImage,
    this.avgRating,
    this.reviewCount,
    this.isOnSale,
    this.isNew,
    this.isBestSeller,
    this.isLowStock,
    this.hasMultipleVariants,
  });

  final String id;
  final String name;
  final String? description;
  final String? categoryId;

  /// **Integer cents.** The cheapest variant's price. See `Money`.
  final int? cheapestPriceCents;

  /// **Integer cents.** The struck-through "was" price, when on sale.
  final int? comparePriceCents;
  final String? coverImage;
  final double? avgRating;
  final int? reviewCount;
  final bool? isOnSale;
  final bool? isNew;
  final bool? isBestSeller;
  final bool? isLowStock;

  /// The price is the lowest of several: show it as "From".
  final bool? hasMultipleVariants;

  factory Product.fromJson(Map<String, dynamic> json) => Product(
        id: json['id'] as String,
        name: json['name'] as String? ?? '',
        description: json['description'] as String?,
        categoryId: json['categoryId'] as String?,
        cheapestPriceCents: (json['cheapestPriceCents'] as num?)?.toInt(),
        comparePriceCents: (json['comparePriceCents'] as num?)?.toInt(),
        coverImage: json['coverImage'] as String?,
        avgRating: (json['avgRating'] as num?)?.toDouble(),
        reviewCount: (json['reviewCount'] as num?)?.toInt(),
        isOnSale: json['isOnSale'] as bool?,
        isNew: json['isNew'] as bool?,
        isBestSeller: json['isBestSeller'] as bool?,
        isLowStock: json['isLowStock'] as bool?,
        hasMultipleVariants: json['hasMultipleVariants'] as bool?,
      );
}

/// The store grid with what a filter UI needs: how many products each
/// category has, and the catalogue's price range.
class ProductListing {
  const ProductListing(
      {required this.items,
      this.categoryCounts = const {},
      this.minDollars,
      this.maxDollars});

  final List<Product> items;

  /// Category id → how many products match the other filters.
  final Map<String, int> categoryCounts;

  /// The catalogue's cheapest and dearest prices, in **dollars**.
  final double? minDollars;
  final double? maxDollars;

  factory ProductListing.fromJson(Map<String, dynamic> json) {
    final range = json['priceRange'];
    return ProductListing(
      items: _list(json['items'], Product.fromJson),
      categoryCounts: {
        for (final row in (json['categoryCounts'] as List?) ?? const [])
          if (row is Map && row['categoryId'] is String)
            row['categoryId'] as String: (row['count'] as num?)?.toInt() ?? 0,
      },
      minDollars:
          range is Map ? (range['minDollars'] as num?)?.toDouble() : null,
      maxDollars:
          range is Map ? (range['maxDollars'] as num?)?.toDouble() : null,
    );
  }
}

/// A store category. (Not `Category`: Flutter's foundation library has one.)
class ProductCategory {
  const ProductCategory({required this.id, required this.name, this.slug});

  final String id;
  final String name;
  final String? slug;

  factory ProductCategory.fromJson(Map<String, dynamic> json) =>
      ProductCategory(
        id: json['id'] as String,
        name: json['name'] as String? ?? '',
        slug: json['slug'] as String?,
      );
}

/// "You may also like". Note the price is `minPriceDollars` — **dollars**,
/// unlike a card's cents — and the photo is `coverImageUrl`.
class RelatedProduct {
  const RelatedProduct(
      {required this.id,
      required this.name,
      this.coverImageUrl,
      this.minPriceDollars});

  final String id;
  final String name;
  final String? coverImageUrl;
  final double? minPriceDollars;

  factory RelatedProduct.fromJson(Map<String, dynamic> json) => RelatedProduct(
        id: json['id'] as String,
        name: json['name'] as String? ?? '',
        coverImageUrl: json['coverImageUrl'] as String?,
        minPriceDollars: (json['minPriceDollars'] as num?)?.toDouble(),
      );
}

/// A customer's review of one product (not a business review: see [Review]).
class ProductReview {
  const ProductReview(
      {required this.id,
      required this.rating,
      this.title,
      this.body,
      this.reviewerName,
      this.createdAt});

  final String id;
  final int rating;
  final String? title;

  /// The review; older rows keep it in `content`.
  final String? body;
  final String? reviewerName;
  final String? createdAt;

  factory ProductReview.fromJson(Map<String, dynamic> json) => ProductReview(
        id: json['id'] as String,
        rating: (json['rating'] as num?)?.toInt() ?? 0,
        title: json['title'] as String?,
        body: (json['body'] as String?) ?? (json['content'] as String?),
        reviewerName: json['reviewerName'] as String?,
        createdAt: json['createdAt'] as String?,
      );
}

class ProductReviewPage {
  const ProductReviewPage(
      {required this.items, this.avgRating, required this.totalCount});

  final List<ProductReview> items;
  final double? avgRating;
  final int totalCount;

  factory ProductReviewPage.fromJson(Map<String, dynamic> json) =>
      ProductReviewPage(
        items: _list(json['items'], ProductReview.fromJson),
        avgRating: (json['avgRating'] as num?)?.toDouble(),
        totalCount: (json['totalCount'] as num?)?.toInt() ?? 0,
      );
}

/// A product sold alongside another ("Complete your …").
class ProductAddon {
  const ProductAddon({
    required this.id,
    required this.addonProductId,
    required this.name,
    this.groupLabel,
    this.priceCents,
    this.originalPriceCents,
    this.imageUrl,
    this.firstVariantId,
  });

  final String id;
  final String addonProductId;
  final String name;
  final String? groupLabel;

  /// **Integer cents.**
  final int? priceCents;
  final int? originalPriceCents;
  final String? imageUrl;

  /// An add-on goes in the cart as its first variant (`variants[0].variantId`).
  final String? firstVariantId;

  factory ProductAddon.fromJson(Map<String, dynamic> json) {
    final variants = json['variants'];
    final first =
        variants is List && variants.isNotEmpty && variants.first is Map
            ? variants.first as Map
            : null;
    // The variant rows' id is `variantId`; `id` is read too, as the web
    // starters do.
    final variantId = first?['variantId'] ?? first?['id'];
    return ProductAddon(
      id: json['id'] as String,
      addonProductId: json['addonProductId'] as String,
      name: json['addonName'] as String? ?? '',
      groupLabel: json['groupLabel'] as String?,
      priceCents: (json['priceCents'] as num?)?.toInt(),
      originalPriceCents: (json['originalPriceCents'] as num?)?.toInt(),
      imageUrl: json['imageUrl'] as String?,
      firstVariantId:
          variantId is String && variantId.isNotEmpty ? variantId : null,
    );
  }
}

/// A cart line. The product's name is **`productName`**, and the chosen
/// style and options are **`variantTitle`** ("Onyx · Size 42").
class CartItem {
  const CartItem({
    required this.id,
    required this.quantity,
    this.productId,
    this.variantId,
    this.name,
    this.variantTitle,
    this.image,
    this.unitPrice,
    this.subtotal,
  });

  final String id;
  final int quantity;
  final String? productId;
  final String? variantId;

  /// The product's name (`productName`).
  final String? name;
  final String? variantTitle;

  /// The product's photo (`productImage`).
  final String? image;

  /// **Already decimal**, unlike [Product.cheapestPriceCents].
  final num? unitPrice;

  /// **Already decimal**: the line's total.
  final num? subtotal;

  factory CartItem.fromJson(Map<String, dynamic> json) => CartItem(
        id: json['id'] as String,
        quantity: (json['quantity'] as num?)?.toInt() ?? 1,
        productId: json['productId'] as String?,
        variantId: json['variantId'] as String?,
        name: (json['productName'] as String?) ?? (json['name'] as String?),
        variantTitle: json['variantTitle'] as String?,
        image: json['productImage'] as String?,
        unitPrice: json['unitPrice'] as num?,
        subtotal: json['subtotal'] as num?,
      );
}

class CartSnapshot {
  const CartSnapshot({
    required this.items,
    this.subtotal,
    this.currency,
    this.couponCode,
    this.itemCount,
  });

  final List<CartItem> items;

  /// **Already decimal.**
  final num? subtotal;
  final String? currency;
  final String? couponCode;

  /// Every unit, not every line: two of one thing count 2.
  final int? itemCount;

  bool get isEmpty => items.isEmpty;

  /// [itemCount], or the lines' quantities added up.
  int get units =>
      itemCount ?? items.fold(0, (sum, item) => sum + item.quantity);

  static const empty = CartSnapshot(items: []);

  factory CartSnapshot.fromJson(Map<String, dynamic> json) => CartSnapshot(
        items: ((json['items'] as List?) ?? [])
            .map((item) => CartItem.fromJson(item as Map<String, dynamic>))
            .toList(),
        subtotal: json['subtotal'] as num?,
        currency: json['currency'] as String?,
        couponCode: json['couponCode'] as String?,
        itemCount: (json['itemCount'] as num?)?.toInt(),
      );
}

class CheckoutSession {
  const CheckoutSession({required this.stripeUrl});

  /// Note the name: **`stripeUrl`**, not `url`.
  final String stripeUrl;

  factory CheckoutSession.fromJson(Map<String, dynamic> json) =>
      CheckoutSession(stripeUrl: json['stripeUrl'] as String);
}

/// Whether a Stripe checkout was paid, by its session id.
class CheckoutStatus {
  const CheckoutStatus({this.paymentStatus, this.customerEmail});

  /// `paid`, `unpaid` or `no_payment_required`.
  final String? paymentStatus;
  final String? customerEmail;

  bool get isPaid => paymentStatus == 'paid';

  factory CheckoutStatus.fromJson(Map<String, dynamic> json) => CheckoutStatus(
        paymentStatus: json['paymentStatus'] as String?,
        customerEmail: json['customerEmail'] as String?,
      );
}

class BlogPost {
  const BlogPost({
    required this.id,
    required this.slug,
    required this.title,
    this.excerpt,
    this.content,
    this.imageUrl,
    this.accessLevel,
    this.categoryId,
    this.publishedAt,
    this.isPinned = false,
    this.authorName,
    this.authorAvatarUrl,
    this.tags = const [],
    this.likes = 0,
    this.ctaLabel,
    this.ctaHref,
    this.ctaDescription,
  });

  final String id;
  final String slug;
  final String title;
  final String? excerpt;

  /// Authored HTML from the dashboard — the field is `content`, not
  /// `contentHtml`. Show it through [PostBlocks], never as it came.
  final String? content;
  final String? imageUrl;

  /// `public` | `followers` | `paid`.
  final String? accessLevel;
  final String? categoryId;
  final String? publishedAt;
  final bool isPinned;
  final String? authorName;
  final String? authorAvatarUrl;
  final List<String> tags;
  final int likes;

  /// The post's call to action: a button's label and link, and a line
  /// above it.
  final String? ctaLabel;
  final String? ctaHref;
  final String? ctaDescription;

  factory BlogPost.fromJson(Map<String, dynamic> json) => BlogPost(
        id: json['id'] as String,
        slug: json['slug'] as String? ?? '',
        title: json['title'] as String? ?? '',
        excerpt: json['excerpt'] as String?,
        content: json['content'] as String?,
        imageUrl: json['imageUrl'] as String?,
        accessLevel: json['accessLevel'] as String?,
        categoryId: json['categoryId'] as String?,
        publishedAt: json['publishedAt'] as String?,
        isPinned: json['isPinned'] as bool? ?? false,
        authorName: json['authorName'] as String?,
        authorAvatarUrl: json['authorAvatarUrl'] as String?,
        tags:
            ((json['tags'] as List?) ?? const []).whereType<String>().toList(),
        likes: (json['likes'] as num?)?.toInt() ?? 0,
        ctaLabel: json['ctaLabel'] as String?,
        ctaHref: json['ctaHref'] as String?,
        ctaDescription: json['ctaDescription'] as String?,
      );
}

/// A page of posts. `nextCursor` is opaque: pass it back for the next page.
class BlogPage {
  const BlogPage({required this.items, this.nextCursor});

  final List<BlogPost> items;
  final int? nextCursor;

  factory BlogPage.fromJson(Map<String, dynamic> json) => BlogPage(
        items: _list(json['items'], BlogPost.fromJson),
        nextCursor: (json['nextCursor'] as num?)?.toInt(),
      );
}

class BlogCategory {
  const BlogCategory(
      {required this.id, required this.name, this.slug, this.description});

  final String id;
  final String name;
  final String? slug;
  final String? description;

  factory BlogCategory.fromJson(Map<String, dynamic> json) => BlogCategory(
        id: json['id'] as String,
        name: json['name'] as String? ?? '',
        slug: json['slug'] as String?,
        description: json['description'] as String?,
      );
}

/// One post arrives **wrapped**: `{ post, access }`. A members-only post
/// comes with an empty body and `access: "paywall"`.
class BlogPostDetail {
  const BlogPostDetail({required this.post, required this.isPaywalled});

  final BlogPost post;
  final bool isPaywalled;

  factory BlogPostDetail.fromJson(Map<String, dynamic> json) => BlogPostDetail(
        post: BlogPost.fromJson(json['post'] as Map<String, dynamic>),
        isPaywalled: json['access'] == 'paywall',
      );
}

class BlogComment {
  const BlogComment(
      {required this.id,
      required this.content,
      this.authorName,
      this.createdAt});

  final String id;
  final String content;
  final String? authorName;
  final String? createdAt;

  factory BlogComment.fromJson(Map<String, dynamic> json) => BlogComment(
        id: json['id'] as String,
        content: json['content'] as String? ?? '',
        authorName: json['authorName'] as String?,
        createdAt: json['createdAt'] as String?,
      );
}

class PostLikes {
  const PostLikes({required this.liked, required this.count});

  /// Whether the signed-in customer liked it; false signed out.
  final bool liked;
  final int count;

  factory PostLikes.fromJson(Map<String, dynamic> json) => PostLikes(
        liked: json['liked'] as bool? ?? false,
        count: (json['likesCount'] as num?)?.toInt() ?? 0,
      );
}

/// A comment, sent. Moderation may hold it for the business to approve.
class CommentPosted {
  const CommentPosted({required this.isApproved});

  final bool isApproved;

  factory CommentPosted.fromJson(Map<String, dynamic> json) {
    final moderation = json['moderation'];
    return CommentPosted(
        isApproved: moderation is Map && moderation['isApproved'] == true);
  }
}

/// A review-wall item: a review of the business, from Google, Yelp or the
/// dashboard. Note `text` and `reviewerName` — not `body` and
/// `authorName`, which is what most APIs would call them.
class Review {
  const Review({
    required this.id,
    required this.rating,
    this.text,
    this.reviewerName,
    this.reviewerImageUrl,
    this.source,
    this.verified,
    this.reviewUrl,
    this.photos = const [],
    this.timeCreated,
  });

  final String id;
  final double rating;
  final String? text;
  final String? reviewerName;
  final String? reviewerImageUrl;

  /// `google` | `yelp` | `housecall_pro` | `other`.
  final String? source;
  final bool? verified;

  /// The review on its own site. Open it through `Reviews.link`, which
  /// keeps web addresses only.
  final String? reviewUrl;
  final List<String> photos;
  final String? timeCreated;

  factory Review.fromJson(Map<String, dynamic> json) => Review(
        id: json['id'] as String,
        rating: (json['rating'] as num?)?.toDouble() ?? 0,
        text: json['text'] as String?,
        reviewerName: json['reviewerName'] as String?,
        reviewerImageUrl: json['reviewerImageUrl'] as String?,
        source: json['source'] as String?,
        verified: json['verified'] as bool?,
        reviewUrl: json['reviewUrl'] as String?,
        photos: ((json['photos'] as List?) ?? const [])
            .whereType<String>()
            .toList(),
        timeCreated: json['timeCreated'] as String?,
      );
}

/// A page of the business's reviews; `nextOffset` is null on the last.
class ReviewPage {
  const ReviewPage(
      {required this.items, this.nextOffset, required this.totalCount});

  final List<Review> items;
  final int? nextOffset;
  final int totalCount;

  factory ReviewPage.fromJson(Map<String, dynamic> json) => ReviewPage(
        items: _list(json['items'], Review.fromJson),
        nextOffset: (json['nextOffset'] as num?)?.toInt(),
        totalCount: (json['totalCount'] as num?)?.toInt() ?? 0,
      );
}

typedef StarCount = ({int rating, int count});

/// The marketing bundle's `reviews`: the average, the count and the count
/// per star over ALL the business's reviews.
class ReviewTotals {
  const ReviewTotals({this.rating, this.totalCount, this.counts = const []});

  final double? rating;
  final int? totalCount;
  final List<StarCount> counts;

  factory ReviewTotals.fromJson(Map<String, dynamic> json) => ReviewTotals(
        rating: (json['rating'] as num?)?.toDouble(),
        totalCount: (json['totalCount'] as num?)?.toInt(),
        counts: [
          for (final row in (json['counts'] as List?) ?? const [])
            if (row is Map && row['rating'] is num && row['count'] is num)
              (
                rating: (row['rating'] as num).toInt(),
                count: (row['count'] as num).toInt()
              ),
        ],
      );
}

List<T> _list<T>(Object? value, T Function(Map<String, dynamic>) read) =>
    value is List
        ? value.whereType<Map<String, dynamic>>().map(read).toList()
        : <T>[];

class SubscriptionPlan {
  const SubscriptionPlan({
    required this.id,
    required this.name,
    this.amountCents,
    this.interval,
  });

  final String id;
  final String name;

  /// **Integer cents** — and named `amountCents`, not `priceCents`.
  final int? amountCents;

  /// `day` | `week` | `month` | `year`.
  final String? interval;

  factory SubscriptionPlan.fromJson(Map<String, dynamic> json) =>
      SubscriptionPlan(
        id: json['id'] as String,
        name: json['name'] as String? ?? '',
        amountCents: (json['amountCents'] as num?)?.toInt(),
        interval: json['interval'] as String?,
      );
}

class FormField {
  const FormField({
    required this.id,
    required this.label,
    required this.type,
    this.placeholder,
    this.required = false,
    this.options = const [],
  });

  final String id;
  final String label;
  final String type;
  final String? placeholder;
  final bool required;
  final List<FormFieldOption> options;

  factory FormField.fromJson(Map<String, dynamic> json) => FormField(
        id: json['id'] as String,
        label: json['label'] as String? ?? '',
        type: json['type'] as String? ?? 'text',
        placeholder: json['placeholder'] as String?,
        required: json['required'] as bool? ?? false,
        options: ((json['options'] as List?) ?? [])
            .map((o) => FormFieldOption.fromJson(o as Map<String, dynamic>))
            .toList(),
      );
}

class FormFieldOption {
  const FormFieldOption({required this.value, required this.label});

  final String value;
  final String label;

  factory FormFieldOption.fromJson(Map<String, dynamic> json) =>
      FormFieldOption(
        value: json['value'] as String? ?? '',
        label: json['label'] as String? ?? '',
      );
}

class FormSchema {
  const FormSchema({required this.slug, this.title, this.fields = const []});

  final String slug;
  final String? title;
  final List<FormField> fields;

  factory FormSchema.fromJson(Map<String, dynamic> json) => FormSchema(
        slug: json['slug'] as String? ?? '',
        title: json['title'] as String?,
        fields: ((json['fields'] as List?) ?? [])
            .map((f) => FormField.fromJson(f as Map<String, dynamic>))
            .toList(),
      );
}

class DataModelRecord {
  const DataModelRecord({required this.id, required this.fields});

  final String id;
  final Map<String, dynamic> fields;

  String? string(String key) => fields[key] as String?;
  bool? boolean(String key) => fields[key] as bool?;

  /// A relation arrives as either a link object carrying `id`, or a bare id
  /// string. Both shapes appear depending on how the object was declared.
  String? relationId(String key) {
    final value = fields[key];
    if (value is Map<String, dynamic>) return value['id'] as String?;
    if (value is String) return value;
    return null;
  }

  factory DataModelRecord.fromJson(Map<String, dynamic> json) =>
      DataModelRecord(
        id: json['id'] as String,
        fields: (json['fields'] as Map<String, dynamic>?) ?? const {},
      );
}

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.role,
    required this.content,
    this.createdAt,
  });

  final String id;
  final String role;

  /// The field is `content`, not `body`.
  final String content;
  final String? createdAt;

  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
        id: json['id'] as String,
        role: json['role'] as String? ?? 'bot',
        content: json['content'] as String? ?? '',
        createdAt: json['createdAt'] as String?,
      );
}
