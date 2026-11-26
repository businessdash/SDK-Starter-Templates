import 'models.dart';

/// The business reviews' shared rules: the rating over every review and its
/// stars breakdown, what each platform is called, which links are safe to
/// open, and what a written review must be. The same rules as every BD
/// starter (`src/shop/reviews.ts` on the web), so the reviews read the same
/// everywhere.
///
/// Two places the reviews come from:
///   * The marketing bundle's `reviews` ([ReviewTotals]): the average, the
///     count and the count per star over ALL the business's reviews.
///   * `reviews` ([ReviewPage]): the reviews a page at a time, newest first,
///     optionally from one platform.
class Reviews {
  const Reviews._();

  static const pageSize = 10;

  /// The longest review BD takes.
  static const maxLength = 5000;

  /// The longest title BD takes; a longer one is cut.
  static const maxTitleLength = 200;

  /// What a customer sees once their review is in.
  static const sent = "Thanks! Your review shows once it's approved.";

  /// The platforms `source` can filter by.
  static const sources = ['google', 'yelp', 'housecall_pro', 'other'];

  static const _platforms = {
    'google': 'Google',
    'yelp': 'Yelp',
    'housecall_pro': 'Housecall Pro'
  };

  /// The average, the count and the breakdown; empty stars count 0.
  static ReviewSummary summarize(ReviewTotals? totals,
      {int fallbackTotal = 0}) {
    final byStars = <int, int>{};
    for (final row in totals?.counts ?? const <StarCount>[]) {
      if (row.rating >= 1 && row.rating <= 5 && row.count > 0) {
        byStars[row.rating] = (byStars[row.rating] ?? 0) + row.count;
      }
    }
    final counted = byStars.values.fold(0, (sum, n) => sum + n);
    final total = totals?.totalCount ?? (counted > 0 ? counted : fallbackTotal);
    final rating = totals?.rating;
    return ReviewSummary(
      average: rating != null && rating.isFinite ? rating : null,
      total: total,
      histogram: [
        for (final stars in [5, 4, 3, 2, 1])
          (
            stars: stars,
            count: byStars[stars] ?? 0,
            share: counted > 0 ? (byStars[stars] ?? 0) / counted : 0.0,
          ),
      ],
    );
  }

  /// "Google", "Yelp", "Housecall Pro"; null for a review added in the
  /// dashboard.
  static String? platformName(String? source) => _platforms[source];

  /// A filter chip's name: the platform, or "Other".
  static String sourceLabel(String? source) => platformName(source) ?? 'Other';

  /// The platforms among some reviews, in the order first seen.
  static List<String> sourcesIn(Iterable<Review> reviews) {
    final seen = <String>[];
    for (final review in reviews) {
      final source = review.source;
      if (source != null &&
          sources.contains(source) &&
          !seen.contains(source)) {
        seen.add(source);
      }
    }
    return seen;
  }

  /// The review on its own site; web links only.
  static String? link(Review review) =>
      platformName(review.source) == null ? null : safeWebUrl(review.reviewUrl);

  /// An http(s) address, or null.
  static String? safeWebUrl(String? url) {
    if (url == null || url.isEmpty) return null;
    final parsed = Uri.tryParse(url);
    return parsed != null &&
            (parsed.scheme == 'https' || parsed.scheme == 'http') &&
            parsed.host.isNotEmpty
        ? url
        : null;
  }

  static String reviewerName(Review review) {
    final name = review.reviewerName?.trim() ?? '';
    return name.isEmpty ? 'Anonymous' : name;
  }

  /// The first letter of the name, for an avatar with no photo.
  static String reviewerInitial(Review review) {
    final name = reviewerName(review);
    return String.fromCharCode(name.runes.first).toUpperCase();
  }

  /// "★★★★☆", rounded to whole stars.
  static String stars(double rating) {
    final full = rating.round().clamp(0, 5);
    return '★' * full + '☆' * (5 - full);
  }

  static const _shortMonths = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec'
  ];

  /// "Nov 20, 2026" (in UTC), or "" for a date that isn't one.
  static String date(String? iso) {
    final parsed = iso == null ? null : DateTime.tryParse(iso)?.toUtc();
    if (parsed == null) return '';
    return '${_shortMonths[parsed.month - 1]} ${parsed.day}, ${parsed.year}';
  }

  /// A written review, checked: what BD takes, or why it can't go.
  static ReviewCheck check(
      {required int rating, String? title, required String body}) {
    if (rating < 1 || rating > 5) {
      return const ReviewCheck.problem('Choose a rating from 1 to 5 stars.');
    }
    final text = body.trim();
    if (text.isEmpty) {
      return const ReviewCheck.problem(
          'Write a few words about your experience.');
    }
    if (text.length > maxLength) {
      return const ReviewCheck.problem('Reviews are up to 5,000 characters.');
    }
    var heading = title?.trim() ?? '';
    if (heading.length > maxTitleLength) {
      heading = heading.substring(0, maxTitleLength);
    }
    return ReviewCheck.ok(ReviewInput(
        rating: rating, title: heading.isEmpty ? null : heading, body: text));
  }
}

/// The rating, the count and a bar per star.
class ReviewSummary {
  const ReviewSummary(
      {required this.average, required this.total, required this.histogram});

  /// Null when the business has no rated reviews.
  final double? average;
  final int total;

  /// 5 stars down to 1; `share` is the part of all reviews, 0 to 1.
  final List<({int stars, int count, double share})> histogram;
}

/// What a customer writes: stars, an optional title and the review.
class ReviewInput {
  const ReviewInput({required this.rating, this.title, required this.body});

  final int rating;
  final String? title;
  final String body;

  Map<String, Object> toJson() =>
      {'rating': rating, if (title != null) 'title': title!, 'body': body};
}

/// [Reviews.check]'s answer: the review to send, or why it can't go.
class ReviewCheck {
  const ReviewCheck.ok(ReviewInput this.review) : error = null;
  const ReviewCheck.problem(String this.error) : review = null;

  final ReviewInput? review;
  final String? error;

  bool get isOk => review != null;
}
