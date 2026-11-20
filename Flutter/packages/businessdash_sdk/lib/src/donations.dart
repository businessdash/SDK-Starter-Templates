import 'client.dart';

/// `ceil((amount + fixed) * 10000 / (10000 - rateBps)) - amount` — the
/// platform's cover-fees formula. Integer inputs and one division, so it
/// lands on the same cent as the server.
int donationCoverFeeCents(int amountCents,
    {required int rateBps, required int fixedCents}) {
  if (amountCents <= 0 || rateBps >= 10000) return 0;
  final gross = ((amountCents + fixedCents) * 10000 / (10000 - rateBps)).ceil();
  return gross - amountCents;
}

/// The org's giving page. Every amount is **integer cents**.
class DonationPage {
  const DonationPage({
    required this.orgName,
    required this.title,
    required this.presetAmountsCents,
    required this.monthlyPresetAmountsCents,
    required this.allowOneTime,
    required this.allowMonthly,
    required this.defaultFrequency,
    required this.minAmountCents,
    required this.maxAmountCents,
    required this.currency,
    required this.offerCoverFees,
    required this.coverFeeRateBps,
    required this.coverFeeFixedCents,
    required this.isTaxDeductible,
    required this.taxStatement,
    this.avatarUrl,
    this.accentColor,
    this.appeal,
    this.platformFeeBps,
    this.thankYouMessage,
    this.unavailable,
    this.hostedUrl,
  });

  final String orgName;
  final String? avatarUrl;

  /// The org's brand accent (hex), for the donate button.
  final String? accentColor;
  final String title;
  final String? appeal;
  final List<int> presetAmountsCents;
  final List<int> monthlyPresetAmountsCents;
  final bool allowOneTime;
  final bool allowMonthly;

  /// `one_time` or `monthly`.
  final String defaultFrequency;
  final int minAmountCents;
  final int maxAmountCents;

  /// Lower-case ISO code, e.g. `usd`.
  final String currency;
  final bool offerCoverFees;
  final int? platformFeeBps;
  final int coverFeeRateBps;
  final int coverFeeFixedCents;
  final String? thankYouMessage;

  /// True only for a registered 501(c)(3) that has entered its EIN.
  final bool isTaxDeductible;

  /// The receipt's tax sentence. Show it verbatim near the donate button.
  final String taxStatement;

  /// `disabled`, `payments_not_ready`, or null when gifts can be taken.
  final String? unavailable;

  /// The BusinessDash-hosted give page, when the org has a site.
  final String? hostedUrl;

  bool get isAcceptingGifts => unavailable == null;

  /// What "cover the fees" adds to [amountCents] — the cents checkout charges.
  int coverFeeCents(int amountCents) => donationCoverFeeCents(amountCents,
      rateBps: coverFeeRateBps, fixedCents: coverFeeFixedCents);

  factory DonationPage.fromJson(Map<String, dynamic> json) {
    List<int> ints(Object? v) =>
        ((v as List?) ?? const []).map((e) => (e as num).toInt()).toList();
    final coverFee = (json['coverFee'] as Map?) ?? const {};
    return DonationPage(
      orgName: json['orgName'] as String,
      avatarUrl: json['avatarUrl'] as String?,
      accentColor: json['accentColor'] as String?,
      title: json['title'] as String,
      appeal: json['appeal'] as String?,
      presetAmountsCents: ints(json['presetAmountsCents']),
      monthlyPresetAmountsCents: ints(json['monthlyPresetAmountsCents']),
      allowOneTime: json['allowOneTime'] as bool,
      allowMonthly: json['allowMonthly'] as bool,
      defaultFrequency: json['defaultFrequency'] as String,
      minAmountCents: (json['minAmountCents'] as num).toInt(),
      maxAmountCents: (json['maxAmountCents'] as num).toInt(),
      currency: json['currency'] as String,
      offerCoverFees: json['offerCoverFees'] as bool,
      platformFeeBps: (json['platformFeeBps'] as num?)?.toInt(),
      coverFeeRateBps: (coverFee['rateBps'] as num? ?? 290).toInt(),
      coverFeeFixedCents: (coverFee['fixedCents'] as num? ?? 30).toInt(),
      thankYouMessage: json['thankYouMessage'] as String?,
      isTaxDeductible: json['isTaxDeductible'] as bool,
      taxStatement: json['taxStatement'] as String,
      unavailable: json['unavailable'] as String?,
      hostedUrl: json['hostedUrl'] as String?,
    );
  }
}

class DonationCheckout {
  const DonationCheckout({
    required this.url,
    required this.frequency,
    required this.amountCents,
    required this.coveredFeeCents,
    required this.totalAmountCents,
    required this.currency,
  });

  /// Stripe-hosted checkout. Open it with `url_launcher`.
  final String url;
  final String frequency;
  final int amountCents;
  final int coveredFeeCents;

  /// What the donor is charged (per month, for monthly gifts).
  final int totalAmountCents;
  final String currency;

  factory DonationCheckout.fromJson(Map<String, dynamic> json) =>
      DonationCheckout(
        url: json['url'] as String,
        frequency: json['frequency'] as String,
        amountCents: (json['amountCents'] as num).toInt(),
        coveredFeeCents: (json['coveredFeeCents'] as num).toInt(),
        totalAmountCents: (json['totalAmountCents'] as num).toInt(),
        currency: json['currency'] as String,
      );
}

/// One-time and monthly gifts, paid on the org's own Stripe account. Works
/// with a publishable key holding `donations:give`.
extension BdDonations on BdClient {
  /// The giving page. Check [DonationPage.isAcceptingGifts] first.
  Future<DonationPage> donationPage() async =>
      DonationPage.fromJson(await get('donations'));

  /// Start a gift and get the Stripe checkout URL.
  ///
  /// The gift is recorded, the donor added as a contact and the receipt
  /// emailed by BusinessDash once Stripe confirms — nothing to call after.
  /// Throws `BdHttpException` 409 (`donations_unavailable`) when giving is off
  /// or payments aren't ready, 400 when the amount, frequency or a return URL
  /// isn't allowed. Return URLs must be on the org's verified domains; omit
  /// both to use the hosted give page.
  Future<DonationCheckout> startDonationCheckout({
    required int amountCents,
    required String donorName,
    required String donorEmail,
    bool monthly = false,
    bool coverFees = false,
    String? message,
    String? successUrl,
    String? cancelUrl,
  }) async =>
      DonationCheckout.fromJson(await post('donations/checkout', body: {
        'amountCents': amountCents,
        'frequency': monthly ? 'monthly' : 'one_time',
        'coverFees': coverFees,
        'donor': {'name': donorName, 'email': donorEmail},
        if (message != null && message.isNotEmpty) 'message': message,
        if (successUrl != null) 'successUrl': successUrl,
        if (cancelUrl != null) 'cancelUrl': cancelUrl,
      }));
}
