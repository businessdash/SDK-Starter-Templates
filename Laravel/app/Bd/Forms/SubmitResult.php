<?php

namespace App\Bd\Forms;

/**
 * How a submit went. A failure's `reason` is one of: client_validation_failed,
 * validation_failed, unauthorized, forbidden, plan_required, payment_required,
 * service_suspended, rate_limited, not_found, invalid_request, server_error,
 * network_error.
 */
final class SubmitResult
{
    /** @param  list<array{fieldId: string, label: string, reason: string, message: string}>  $issues */
    private function __construct(
        public readonly bool $ok,
        public readonly int $status,
        public readonly ?string $submissionId = null,
        public readonly bool $dryRun = false,
        public readonly ?string $reason = null,
        public readonly string $message = '',
        public readonly array $issues = [],
    ) {}

    public static function success(int $status = 201, ?string $submissionId = null, bool $dryRun = false): self
    {
        return new self(true, $status, $submissionId, $dryRun);
    }

    public static function failure(int $status, string $reason, string $message, array $issues = []): self
    {
        return new self(false, $status, reason: $reason, message: $message, issues: $issues);
    }

    /** Map a Package API error response onto a failure. */
    public static function fromResponse(int $status, mixed $body): self
    {
        $message = Json::str(Json::get($body, 'message'));
        $message = $message === null || $message === '' ? "Submission failed ({$status})." : $message;
        $code = Json::str(Json::get($body, 'error'));
        $gate = Json::str(Json::get($body, 'reason'));
        $issues = [];
        foreach (Json::list(Json::get($body, 'issues')) ?? [] as $raw) {
            $id = Json::str(Json::get($raw, 'id')) ?? Json::str(Json::get($raw, 'fieldId')) ?? '';
            $label = Json::str(Json::get($raw, 'label')) ?? ($id === '' ? 'field' : $id);
            $why = Json::str(Json::get($raw, 'reason')) ?? 'type';
            $issues[] = [
                'fieldId' => $id,
                'label' => $label,
                'reason' => $why,
                'message' => Json::str(Json::get($raw, 'message')) ?? Messages::message($why, $label, null),
            ];
        }
        $reason = match (true) {
            $status === 401 => 'unauthorized',
            $status === 403 => 'forbidden',
            $status === 402 => match ($gate) {
                'payment_required' => 'payment_required',
                'service_suspended' => 'service_suspended',
                default => 'plan_required',
            },
            $status === 429 => 'rate_limited',
            $status === 404 => 'not_found',
            $status === 400, $status === 422 => $code === 'validation_failed' || $issues ? 'validation_failed' : 'invalid_request',
            default => 'server_error',
        };

        return self::failure($status, $reason, $message, $issues);
    }
}
