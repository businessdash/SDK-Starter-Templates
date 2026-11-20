import Vapor

// MARK: - Donations

/// The org's giving page. Every amount is **integer cents**.
struct DonationPage: Content {
    struct CoverFee: Content {
        /// Stripe's percentage plus the platform's, in basis points.
        let rateBps: Int
        /// Stripe's fixed per-charge amount.
        let fixedCents: Int
    }

    let orgName: String
    let avatarUrl: String?
    let accentColor: String?
    let title: String
    let appeal: String?
    let presetAmountsCents: [Int]
    let monthlyPresetAmountsCents: [Int]
    let allowOneTime: Bool
    let allowMonthly: Bool
    /// `one_time` or `monthly`.
    let defaultFrequency: String
    let minAmountCents: Int
    let maxAmountCents: Int
    let currency: String
    let offerCoverFees: Bool
    let platformFeeBps: Int?
    let coverFee: CoverFee
    let thankYouMessage: String?
    /// True only for a registered 501(c)(3) that has entered its EIN.
    let isTaxDeductible: Bool
    /// The receipt's tax sentence. Render it verbatim near the donate button.
    let taxStatement: String
    /// `disabled`, `payments_not_ready`, or nil when gifts can be taken.
    let unavailable: String?
    /// The BusinessDash-hosted give page, when the org has a site.
    let hostedUrl: String?

    var isAcceptingGifts: Bool { unavailable == nil }

    /// What "cover the fees" adds — the same cents the checkout charges:
    /// `ceil((amount + fixed) * 10000 / (10000 - rateBps)) - amount`.
    func coverFeeCents(for amountCents: Int) -> Int {
        guard amountCents > 0, coverFee.rateBps < 10_000 else { return 0 }
        let numerator = Double((amountCents + coverFee.fixedCents) * 10_000)
        let gross = Int((numerator / Double(10_000 - coverFee.rateBps)).rounded(.up))
        return gross - amountCents
    }
}

struct DonationDonor: Content {
    let name: String
    let email: String
}

struct DonationCheckoutInput: Content {
    /// The gift, in cents, before any covered fee.
    let amountCents: Int
    /// `one_time` or `monthly`.
    let frequency: String
    let coverFees: Bool?
    let donor: DonationDonor
    let message: String?
    /// Must be on one of the org's verified domains (this server's public
    /// origin). Omit both to return to the hosted give page.
    let successUrl: String?
    let cancelUrl: String?
}

struct DonationCheckout: Content {
    /// Stripe-hosted checkout. Redirect the donor here.
    let url: String
    let frequency: String
    let amountCents: Int
    let coveredFeeCents: Int
    let totalAmountCents: Int
    let currency: String
}

extension BdClient {
    /// The giving page for this org. Check `isAcceptingGifts` first.
    func donationPage() async throws -> DonationPage {
        try await get("donations")
    }

    /// Start a one-time or monthly gift; redirect to the returned `url`.
    ///
    /// The gift is recorded, the donor added as a contact and the receipt
    /// emailed by BusinessDash once Stripe confirms — nothing to call after.
    func startDonationCheckout(_ input: DonationCheckoutInput) async throws -> DonationCheckout {
        try await post("donations/checkout", body: input)
    }
}
