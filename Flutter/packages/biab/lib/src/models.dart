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
    this.cheapestPriceCents,
    this.comparePriceCents,
    this.coverImage,
    this.avgRating,
    this.reviewCount,
    this.isOnSale,
  });

  final String id;
  final String name;
  final String? description;

  /// **Integer cents.** The cheapest variant's price. See `Money`.
  final int? cheapestPriceCents;

  /// **Integer cents.** The struck-through "was" price, when on sale.
  final int? comparePriceCents;
  final String? coverImage;
  final double? avgRating;
  final int? reviewCount;
  final bool? isOnSale;

  factory Product.fromJson(Map<String, dynamic> json) => Product(
        id: json['id'] as String,
        name: json['name'] as String? ?? '',
        description: json['description'] as String?,
        cheapestPriceCents: (json['cheapestPriceCents'] as num?)?.toInt(),
        comparePriceCents: (json['comparePriceCents'] as num?)?.toInt(),
        coverImage: json['coverImage'] as String?,
        avgRating: (json['avgRating'] as num?)?.toDouble(),
        reviewCount: (json['reviewCount'] as num?)?.toInt(),
        isOnSale: json['isOnSale'] as bool?,
      );
}

class CartItem {
  const CartItem({
    required this.id,
    required this.quantity,
    this.name,
    this.unitPrice,
  });

  final String id;
  final int quantity;
  final String? name;

  /// **Already decimal**, unlike [Product.cheapestPriceCents].
  final num? unitPrice;

  factory CartItem.fromJson(Map<String, dynamic> json) => CartItem(
        id: json['id'] as String,
        quantity: (json['quantity'] as num?)?.toInt() ?? 1,
        name: json['name'] as String?,
        unitPrice: json['unitPrice'] as num?,
      );
}

class CartSnapshot {
  const CartSnapshot({
    required this.items,
    this.subtotal,
    this.currency,
    this.couponCode,
  });

  final List<CartItem> items;

  /// **Already decimal.**
  final num? subtotal;
  final String? currency;
  final String? couponCode;

  bool get isEmpty => items.isEmpty;

  static const empty = CartSnapshot(items: []);

  factory CartSnapshot.fromJson(Map<String, dynamic> json) => CartSnapshot(
        items: ((json['items'] as List?) ?? [])
            .map((item) => CartItem.fromJson(item as Map<String, dynamic>))
            .toList(),
        subtotal: json['subtotal'] as num?,
        currency: json['currency'] as String?,
        couponCode: json['couponCode'] as String?,
      );
}

class CheckoutSession {
  const CheckoutSession({required this.stripeUrl});

  /// Note the name: **`stripeUrl`**, not `url`.
  final String stripeUrl;

  factory CheckoutSession.fromJson(Map<String, dynamic> json) =>
      CheckoutSession(stripeUrl: json['stripeUrl'] as String);
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
  });

  final String id;
  final String slug;
  final String title;
  final String? excerpt;

  /// Authored HTML from the dashboard — the field is `content`, not
  /// `contentHtml`.
  final String? content;
  final String? imageUrl;

  /// `public` | `followers` | `paid`.
  final String? accessLevel;

  factory BlogPost.fromJson(Map<String, dynamic> json) => BlogPost(
        id: json['id'] as String,
        slug: json['slug'] as String? ?? '',
        title: json['title'] as String? ?? '',
        excerpt: json['excerpt'] as String?,
        content: json['content'] as String?,
        imageUrl: json['imageUrl'] as String?,
        accessLevel: json['accessLevel'] as String?,
      );
}

/// A review-wall item. Note `text` and `reviewerName` — not `body` and
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
  });

  final String id;
  final double rating;
  final String? text;
  final String? reviewerName;
  final String? reviewerImageUrl;
  final String? source;
  final bool? verified;

  factory Review.fromJson(Map<String, dynamic> json) => Review(
        id: json['id'] as String,
        rating: (json['rating'] as num?)?.toDouble() ?? 0,
        text: json['text'] as String?,
        reviewerName: json['reviewerName'] as String?,
        reviewerImageUrl: json['reviewerImageUrl'] as String?,
        source: json['source'] as String?,
        verified: json['verified'] as bool?,
      );
}

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
