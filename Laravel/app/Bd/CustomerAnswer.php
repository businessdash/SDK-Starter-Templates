<?php

namespace App\Bd;

/**
 * BD's answer to one step of customer sign-in (`CustomerAuth::forward`):
 *
 *   answered  the business's options, or a code on its way (`pendingId`) —
 *             from sign-in, that means "confirm your email first"
 *   signedIn  someone signed in: the token for the httpOnly cookie
 *   refused   BD's own refusal (wrong password, expired code…), or BD out of reach
 */
final class CustomerAnswer
{
    /** @param  array<string, mixed>  $body */
    private function __construct(
        public readonly string $kind,
        public readonly array $body = [],
        public readonly ?string $token = null,
        public readonly ?string $expiresAt = null,
        public readonly int $status = 200,
        public readonly ?string $code = null,
        public readonly ?string $message = null,
    ) {}

    /** @param  array<string, mixed>  $body */
    public static function answered(array $body): self
    {
        return new self('answered', $body);
    }

    /** @param  array<string, mixed>  $body */
    public static function signedIn(string $token, string $expiresAt, array $body): self
    {
        return new self('signedIn', $body, $token, $expiresAt);
    }

    public static function refused(int $status, string $code, string $message): self
    {
        return new self('refused', status: $status, code: $code, message: $message);
    }

    public function isAnswered(): bool
    {
        return $this->kind === 'answered';
    }

    public function isSignedIn(): bool
    {
        return $this->kind === 'signedIn';
    }

    /** A code was sent: the id to verify it with, or null. */
    public function pendingId(): ?string
    {
        return $this->isAnswered() && is_string($this->body['pendingId'] ?? null) ? $this->body['pendingId'] : null;
    }
}
