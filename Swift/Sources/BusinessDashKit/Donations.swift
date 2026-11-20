import Foundation

// MARK: - Donations

/// The org's giving page. Every amount is **integer cents**.
public struct DonationPage: Decodable, Sendable, Equatable {
    public struct CoverFee: Decodable, Sendable, Equatable {
        /// Stripe's percentage plus the platform's, in basis points.
        public let rateBps: Int
        /// Stripe's fixed per-charge amount.
        public let fixedCents: Int
    }

    public let orgName: String
    public let avatarUrl: String?
    /// The org's brand accent (hex), for the donate button.
    public let accentColor: String?
    public let title: String
    public let appeal: String?
    public let presetAmountsCents: [Int]
    public let monthlyPresetAmountsCents: [Int]
    public let allowOneTime: Bool
    public let allowMonthly: Bool
    /// `one_time` or `monthly`.
    public let defaultFrequency: String
    public let minAmountCents: Int
    public let maxAmountCents: Int
    /// Lower-case ISO code, e.g. `usd`.
    public let currency: String
    public let offerCoverFees: Bool
    public let platformFeeBps: Int?
    public let coverFee: CoverFee
    public let thankYouMessage: String?
    /// True only for a registered 501(c)(3) that has entered its EIN.
    public let isTaxDeductible: Bool
    /// The sentence the donor's receipt carries about tax treatment. Show it
    /// near the donate button, verbatim, so the page and receipt agree.
    public let taxStatement: String
    /// `disabled`, `payments_not_ready`, or nil when gifts can be taken.
    public let unavailable: String?
    /// The BusinessDash-hosted give page, when the org has a site.
    public let hostedUrl: String?

    /// True when the page can take a gift right now.
    public var isAcceptingGifts: Bool { unavailable == nil }

    /// What "cover the fees" adds to `amountCents` — the same cents the
    /// checkout charges.
    public func coverFeeCents(for amountCents: Int) -> Int {
        Self.coverFeeCents(amountCents, rateBps: coverFee.rateBps, fixedCents: coverFee.fixedCents)
    }

    /// `ceil((amount + fixed) * 10000 / (10000 - rateBps)) - amount`, the
    /// platform's formula. Integer inputs, one division, so it lands on the
    /// same cent as the server.
    public static func coverFeeCents(_ amountCents: Int, rateBps: Int, fixedCents: Int) -> Int {
        guard amountCents > 0, rateBps < 10_000 else { return 0 }
        let numerator = Double((amountCents + fixedCents) * 10_000)
        let gross = Int((numerator / Double(10_000 - rateBps)).rounded(.up))
        return gross - amountCents
    }
}

public struct DonationDonor: Encodable, Sendable {
    public let name: String
    public let email: String
    public init(name: String, email: String) {
        self.name = name
        self.email = email
    }
}

public struct DonationCheckoutInput: Encodable, Sendable {
    /// The gift, in cents, before any covered fee.
    public let amountCents: Int
    /// `one_time` or `monthly`.
    public let frequency: String
    public let coverFees: Bool?
    public let donor: DonationDonor
    public let message: String?
    /// Must be on one of the org's verified domains. Omit both to return to
    /// the hosted give page.
    public let successUrl: String?
    public let cancelUrl: String?

    public init(
        amountCents: Int,
        monthly: Bool = false,
        coverFees: Bool = false,
        donor: DonationDonor,
        message: String? = nil,
        successURL: String? = nil,
        cancelURL: String? = nil
    ) {
        self.amountCents = amountCents
        self.frequency = monthly ? "monthly" : "one_time"
        self.coverFees = coverFees
        self.donor = donor
        self.message = message?.nilIfEmpty
        self.successUrl = successURL
        self.cancelUrl = cancelURL
    }
}

public struct DonationCheckout: Decodable, Sendable {
    /// Stripe-hosted checkout. Open it in the browser.
    public let url: String
    public let frequency: String
    public let amountCents: Int
    public let coveredFeeCents: Int
    /// What the donor is charged (per month, for monthly gifts).
    public let totalAmountCents: Int
    public let currency: String

    public var checkoutURL: URL? { URL(string: url) }
}

/// One-time and monthly gifts, paid on the org's own Stripe account. Works
/// with a publishable key holding `donations:give`.
///
/// The gift is recorded, the donor added as a contact and the receipt
/// emailed by BusinessDash once Stripe confirms payment — there is nothing
/// to call after the redirect.
public struct DonationsResource: Sendable {
    let client: BdClient

    /// The giving page. Check `isAcceptingGifts` before showing a form.
    public func page() async throws -> DonationPage {
        try await client.get("donations")
    }

    /// Start a gift and get the Stripe checkout URL to open.
    ///
    /// Throws a 409 (`donations_unavailable`) when giving is off or payments
    /// aren't ready, and a 400 when the amount or frequency isn't allowed or a
    /// return URL isn't on a verified domain.
    public func startCheckout(_ input: DonationCheckoutInput) async throws -> DonationCheckout {
        try await client.post("donations/checkout", body: input)
    }
}

extension BdClient {
    public var donations: DonationsResource { DonationsResource(client: self) }
}
