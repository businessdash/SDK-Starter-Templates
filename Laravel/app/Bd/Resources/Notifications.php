<?php

namespace App\Bd\Resources;

use App\Bd\Client;

/**
 * What a customer wants to hear about, and where.
 *
 * ## Preferences are per ORG, not per person
 *
 * A customer who buys from three businesses on this platform has three
 * independent preference matrices. Muting marketing email from one must not
 * mute it from the others — they are separate relationships, and collapsing
 * them into one setting would either leak a decision across companies or force
 * the customer to accept the loudest of them.
 *
 * So `$organizationId` is how you choose whose settings you are editing. Pass
 * an org id from `Portal::myOtherCustomerOrgs()`.
 *
 * ## The matrix is sparse on write
 *
 * `update()` merges: send `['marketing' => ['email' => false]]` and only that
 * flips. Send the full matrix to overwrite. The response is the MERGED result
 * and that is what you should render — echoing the request back shows the
 * customer a matrix the server never agreed to.
 *
 * ## Destinations are inert until verified
 *
 * Adding an address or number does not start sending to it. `startVerification()`
 * sends a link (email, 15-minute TTL) or a 6-digit OTP (phone, 5 minutes);
 * `confirmVerification()` consumes the token. Until then the channel stays off,
 * because otherwise anyone with a session could point a company's
 * notifications at an address they do not control.
 */
class Notifications
{
    public function __construct(
        private readonly Client $client,
        private readonly string $sessionToken,
        private readonly ?string $organizationId = null,
    ) {
    }

    /**
     * This org's preference matrix, plus the category and channel definitions
     * needed to render it.
     *
     * @return array<string, mixed>
     */
    public function get(): array
    {
        return $this->client->get(
            'customer-portal/notification-preferences',
            [],
            $this->headers()
        );
    }

    /**
     * Merge a sparse preference update into the stored matrix.
     *
     * @param  array<string, array<string, bool>>  $preferences
     * @return array<string, mixed> the MERGED matrix — render this
     */
    public function update(array $preferences): array
    {
        return $this->client->post(
            'customer-portal/notification-preferences',
            ['preferences' => $preferences],
            $this->headers()
        );
    }

    /**
     * Send a verification link ($kind = "email") or a 6-digit OTP
     * ($kind = "phone") to $destination.
     *
     * @return array<string, mixed>
     */
    public function startVerification(string $kind, string $destination): array
    {
        return $this->client->post(
            'notifications/preferences/verify',
            ['kind' => $kind, 'destination' => $destination],
            $this->headers()
        );
    }

    /** @return array<string, mixed> */
    public function startEmailVerification(string $destination): array
    {
        return $this->startVerification('email', $destination);
    }

    /** @return array<string, mixed> */
    public function startPhoneVerification(string $destination): array
    {
        return $this->startVerification('phone', $destination);
    }

    /**
     * Consume the token from the email link or the SMS code.
     *
     * Takes only the token: the server already knows which destination it was
     * issued for, and accepting a caller-supplied one would let a token minted
     * for one address verify another.
     *
     * @return array<string, mixed>
     */
    public function confirmVerification(string $token): array
    {
        return $this->client->post(
            'notifications/preferences/verify/confirm',
            ['token' => $token],
            $this->headers()
        );
    }

    /** @return array<string, string> */
    private function headers(): array
    {
        $out = ['X-BD-Session-Token' => $this->sessionToken];
        if ($this->organizationId) {
            $out['X-BD-Customer-Portal-Org'] = $this->organizationId;
        }

        return $out;
    }
}
