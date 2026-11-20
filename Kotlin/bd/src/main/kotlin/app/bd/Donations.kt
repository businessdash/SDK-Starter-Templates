package app.bd

import kotlinx.serialization.Serializable
import kotlin.math.ceil

// ── Donations ─────────────────────────────────────────────────────────────

/** Inputs for the cover-fees top-up: combined percentage (bps) and fixed cents. */
@Serializable
public data class DonationCoverFee(
    val rateBps: Int,
    val fixedCents: Int,
)

/** The org's giving page. Every amount is **integer cents**. */
@Serializable
public data class DonationPage(
    val orgName: String,
    val avatarUrl: String? = null,
    /** The org's brand accent (hex), for the donate button. */
    val accentColor: String? = null,
    val title: String,
    val appeal: String? = null,
    val presetAmountsCents: List<Int> = emptyList(),
    val monthlyPresetAmountsCents: List<Int> = emptyList(),
    val allowOneTime: Boolean,
    val allowMonthly: Boolean,
    /** `one_time` or `monthly`. */
    val defaultFrequency: String,
    val minAmountCents: Int,
    val maxAmountCents: Int,
    /** Lower-case ISO code, e.g. `usd`. */
    val currency: String,
    val offerCoverFees: Boolean,
    val platformFeeBps: Int? = null,
    val coverFee: DonationCoverFee,
    val thankYouMessage: String? = null,
    /** True only for a registered 501(c)(3) that has entered its EIN. */
    val isTaxDeductible: Boolean,
    /** The receipt's tax sentence. Show it verbatim near the donate button. */
    val taxStatement: String,
    /** `disabled`, `payments_not_ready`, or null when gifts can be taken. */
    val unavailable: String? = null,
    /** The BusinessDash-hosted give page, when the org has a site. */
    val hostedUrl: String? = null,
) {
    val isAcceptingGifts: Boolean get() = unavailable == null

    /** What "cover the fees" adds to [amountCents] — the cents checkout charges. */
    public fun coverFeeCents(amountCents: Int): Int =
        donationCoverFeeCents(amountCents, coverFee.rateBps, coverFee.fixedCents)
}

/**
 * `ceil((amount + fixed) * 10000 / (10000 - rateBps)) - amount` — the
 * platform's formula. Integer inputs and one division, so it lands on the
 * same cent as the server.
 */
public fun donationCoverFeeCents(amountCents: Int, rateBps: Int, fixedCents: Int): Int {
    if (amountCents <= 0 || rateBps >= 10_000) return 0
    val numerator = ((amountCents + fixedCents).toLong() * 10_000L).toDouble()
    val gross = ceil(numerator / (10_000 - rateBps).toDouble()).toInt()
    return gross - amountCents
}

@Serializable
public data class DonationDonor(val name: String, val email: String)

@Serializable
public data class DonationCheckoutInput(
    /** The gift, in cents, before any covered fee. */
    val amountCents: Int,
    /** `one_time` or `monthly`. */
    val frequency: String,
    val donor: DonationDonor,
    val coverFees: Boolean? = null,
    val message: String? = null,
    /** Must be on one of the org's verified domains. Omit both for the hosted page. */
    val successUrl: String? = null,
    val cancelUrl: String? = null,
)

@Serializable
public data class DonationCheckout(
    /** Stripe-hosted checkout. Open it in a browser / Custom Tab. */
    val url: String,
    val frequency: String,
    val amountCents: Int,
    val coveredFeeCents: Int,
    /** What the donor is charged (per month, for monthly gifts). */
    val totalAmountCents: Int,
    val currency: String,
)

/**
 * The giving page for this org. Check [DonationPage.isAcceptingGifts] before
 * showing a form. Works with a publishable key holding `donations:give`.
 */
public suspend fun BdClient.donationPage(): DonationPage = get("donations")

/**
 * Start a one-time or monthly gift and get the Stripe checkout URL.
 *
 * The gift is recorded, the donor added as a contact and the receipt emailed
 * by BusinessDash once Stripe confirms — nothing to call after the redirect.
 * Throws [BdHttpException] 409 (`donations_unavailable`) when giving is off or
 * payments aren't ready, 400 when the amount, frequency or a return URL isn't
 * allowed.
 */
public suspend fun BdClient.startDonationCheckout(input: DonationCheckoutInput): DonationCheckout =
    post("donations/checkout", input)
