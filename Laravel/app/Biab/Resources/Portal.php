<?php

namespace App\Biab\Resources;

use App\Biab\Client;

/**
 * Customer portal — everything scoped to the signed-in customer's session
 * token, which this app reads from its own `biab_session` cookie.
 *
 * `$organizationId` pins the portal to one org. Pass it whenever this site
 * represents a single business; leave it null for a multi-org portal where
 * the customer picks (`myOtherCustomerOrgs()`).
 */
class Portal
{
    public function __construct(
        private readonly Client $client,
        private readonly string $sessionToken,
        private readonly ?string $organizationId = null,
    ) {
    }

    /** Org branding + which portal features are on. Call before rendering. */
    public function context(): array
    {
        return $this->client->get('customer-portal/context', [], $this->headers());
    }

    /** The work feed: jobs, quotes, invoices, orders in one bundle. */
    public function getWork(): array
    {
        return $this->client->get('customer-portal/work', [], $this->headers());
    }

    public function getProfile(): array
    {
        return $this->client->get('customer-portal/profile', [], $this->headers());
    }

    public function myOtherCustomerOrgs(): array
    {
        return $this->client->get('customer-portal/other-orgs', [], $this->headers());
    }

    public function getJob(string $jobId): array
    {
        return $this->client->get('customer-portal/jobs/'.rawurlencode($jobId), [], $this->headers());
    }

    public function getJobActivity(string $jobId): array
    {
        return $this->client->get(
            'customer-portal/jobs/'.rawurlencode($jobId).'/activity', [], $this->headers()
        );
    }

    public function getQuote(string $quoteId): array
    {
        return $this->client->get('customer-portal/quotes/'.rawurlencode($quoteId), [], $this->headers());
    }

    public function acceptQuote(string $quoteId): array
    {
        return $this->client->post(
            'customer-portal/quotes/'.rawurlencode($quoteId).'/accept', null, $this->headers()
        );
    }

    public function rejectQuote(string $quoteId): array
    {
        return $this->client->post(
            'customer-portal/quotes/'.rawurlencode($quoteId).'/reject', null, $this->headers()
        );
    }

    public function getInvoice(string $invoiceId): array
    {
        return $this->client->get('customer-portal/invoices/'.rawurlencode($invoiceId), [], $this->headers());
    }

    public function listOrders(?int $limit = null, int|string|null $cursor = null): array
    {
        return $this->client->get('customer-portal/orders', [
            'limit' => $limit,
            'cursor' => $cursor,
        ], $this->headers());
    }

    public function listPayments(?int $limit = null, int|string|null $cursor = null): array
    {
        return $this->client->get('customer-portal/payments', [
            'limit' => $limit,
            'cursor' => $cursor,
        ], $this->headers());
    }

    /** @param array<string, mixed> $input rating (1–5) + body */
    public function submitReview(array $input): array
    {
        return $this->client->post('customer-portal/reviews', $input, $this->headers());
    }

    public function getNotificationPreferences(): array
    {
        return $this->client->get('customer-portal/notification-preferences', [], $this->headers());
    }

    /** @param array<string, mixed> $input */
    public function updateNotificationPreferences(array $input): array
    {
        return $this->client->post('customer-portal/notification-preferences', $input, $this->headers());
    }

    /** @return array<string, string> */
    // ── Subscription ────────────────────────────────────────────────────

    /**
     * Subscription state plus the org's live offerings.
     *
     * Render entitlement from `hasAccess`, never from `status`: a lifetime
     * purchase has no period to expire, and a cancelled subscription keeps
     * access until the period already paid for ends. `hasAccess` is computed
     * server-side by the same function the content gates use, so the portal
     * and the gate cannot disagree.
     *
     * @return array<string, mixed>
     */
    public function subscription(): array
    {
        return $this->client->get('customer-portal/subscription', [], $this->headers());
    }

    /**
     * Cancel at the end of the paid period.
     *
     * Ends the RENEWAL, not the access — the customer has paid for the period
     * they are in and keeps everything until `accessUntil`. Read that back to
     * them as "active until <date>", because that is what is true.
     *
     * @return array<string, mixed>
     */
    public function cancelSubscription(): array
    {
        return $this->client->post(
            'customer-portal/subscription/cancel',
            ['resume' => false],
            $this->headers()
        );
    }

    /**
     * Clear a pending cancellation. Nothing has been lost yet, so changing
     * your mind should cost one call rather than a re-purchase.
     *
     * @return array<string, mixed>
     */
    public function resumeSubscription(): array
    {
        return $this->client->post(
            'customer-portal/subscription/cancel',
            ['resume' => true],
            $this->headers()
        );
    }

    /**
     * What the subscription entitles them to.
     *
     * When `entitled` is false these are LOCKED previews, not an empty
     * entitlement: titles and excerpts, no bodies. Show them beside the offer
     * — an empty list would hide the pitch at the moment it matters most.
     *
     * @return array<string, mixed>
     */
    public function subscriberContent(?int $limit = null): array
    {
        return $this->client->get(
            'customer-portal/subscription/content',
            $limit === null ? [] : ['limit' => (string) $limit],
            $this->headers()
        );
    }

    private function headers(): array
    {
        $out = ['X-BIAB-Session-Token' => $this->sessionToken];
        if ($this->organizationId) {
            $out['X-BIAB-Customer-Portal-Org'] = $this->organizationId;
        }

        return $out;
    }
}
