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
    private function headers(): array
    {
        $out = ['X-BIAB-Session-Token' => $this->sessionToken];
        if ($this->organizationId) {
            $out['X-BIAB-Customer-Portal-Org'] = $this->organizationId;
        }

        return $out;
    }
}
