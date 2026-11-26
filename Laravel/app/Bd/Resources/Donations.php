<?php

namespace App\Bd\Resources;

use App\Bd\Client;

/**
 * One-time and monthly gifts, paid on the org's own Stripe account.
 *
 * `page()` returns the giving page — presets, which frequencies are offered,
 * the minimum, and the tax statement the receipt will carry. `startCheckout()`
 * returns a Stripe Checkout URL; redirect to it with a 303.
 *
 * The gift is recorded, the donor added as a contact and the receipt emailed
 * by BusinessDash once Stripe confirms — nothing to call after the redirect.
 * Needs a key holding `donations:give`.
 */
class Donations
{
    public function __construct(private readonly Client $client) {}

    /**
     * The giving page. Check `unavailable` (null when gifts can be taken)
     * before showing a form. Amounts are integer cents.
     *
     * @return array<string, mixed>
     */
    public function page(): array
    {
        return $this->client->get('donations');
    }

    /**
     * Start a gift.
     *
     * `$input` keys: `amountCents` (int, before any covered fee), `frequency`
     * (`one_time` | `monthly`), `donor` (`['name' => …, 'email' => …]`), and
     * optionally `coverFees` (bool), `message`, `successUrl`, `cancelUrl`.
     * Return URLs must be on one of the org's verified domains; omit both to
     * use the hosted give page.
     *
     * Throws BdApiException 409 (`donations_unavailable`) when giving is off
     * or payments aren't ready, and 400 when the amount, frequency or a return
     * URL isn't allowed.
     *
     * @param  array<string, mixed>  $input
     * @return array<string, mixed> url, frequency, amountCents, coveredFeeCents, totalAmountCents, currency
     */
    public function startCheckout(array $input): array
    {
        return $this->client->post('donations/checkout', $input);
    }

    /**
     * What "cover the fees" adds to a gift — the same cents the checkout
     * charges. Pass the page's `coverFee` array.
     *
     * `ceil((amount + fixedCents) * 10000 / (10000 - rateBps)) - amount`.
     *
     * @param  array{rateBps: int, fixedCents: int}  $coverFee
     */
    public static function coverFeeCents(int $amountCents, array $coverFee): int
    {
        $rate = (int) $coverFee['rateBps'];
        if ($amountCents <= 0 || $rate >= 10000) {
            return 0;
        }
        $gross = (int) ceil((($amountCents + (int) $coverFee['fixedCents']) * 10000) / (10000 - $rate));

        return $gross - $amountCents;
    }
}
