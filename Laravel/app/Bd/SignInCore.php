<?php

namespace App\Bd;

/**
 * The sign-in screen's words, checks and brand colours: a PHP port of
 * `@businessdash/sdk/sign-in-core`, so this site renders the same screen as
 * every other starter (`<BdSignIn>`, the Swift app's `BdSignInView`, Kotlin's
 * `:bd-sign-in`). Keep it in step with the SDK.
 */
final class SignInCore
{
    /** Every box the screen can show. */
    public const FIELDS = ['firstName', 'lastName', 'email', 'password', 'code', 'newPassword'];

    /** The "Continue with …" providers, in the order the screen shows them. */
    public const PROVIDERS = ['apple', 'google', 'github', 'discord'];

    /** DEFAULT_SIGN_IN_STRINGS */
    public const WORDS = [
        'signInTitle' => 'Sign in to {name}',
        'createTitle' => 'Create your {name} account',
        'createSubtitle' => 'Your account with {name}. We\'ll email you a code to confirm it.',
        'signInTitleNoName' => 'Sign in',
        'createTitleNoName' => 'Create your account',
        'createSubtitleNoName' => 'We\'ll email you a code to confirm it.',
        'forgotTitle' => 'Reset your password',
        'forgotSubtitle' => 'Enter your email and we\'ll send you a code.',
        'codeTitle' => 'Check your email',
        'codeSubtitle' => 'We sent a 6-digit code to {email}.',
        'codeResetSubtitle' => 'We sent a 6-digit code to {email}. Enter it with your new password.',
        'passwordRule' => 'At least 10 characters.',
        'signIn' => 'Sign in',
        'createAccount' => 'Create account',
        'sendCode' => 'Send code',
        'confirm' => 'Continue',
        'resendCode' => 'Send a new code',
        'codeResent' => 'A new code is on its way.',
        'forgotPassword' => 'Forgot password?',
        'noAccount' => 'New here? Create an account',
        'haveAccount' => 'Already have an account? Sign in',
        'backToSignIn' => 'Back to sign in',
        'or' => 'or',
        'enterEmail' => 'Enter your email.',
        'invalidEmail' => 'Enter a full email address, like name@example.com.',
        'enterPassword' => 'Enter your password.',
        'enterCode' => 'Enter the 6-digit code from the email.',
        'passwordTooShort' => 'Use at least 10 characters for your password.',
        'passwordTooLong' => 'Use 256 characters or fewer for your password.',
        'nameTooLong' => 'Use 100 characters or fewer.',
    ];

    public const LABELS = [
        'firstName' => 'First name',
        'lastName' => 'Last name',
        'email' => 'Email',
        'password' => 'Password',
        'code' => '6-digit code',
        'newPassword' => 'New password',
    ];

    public const CONTINUE_WITH = [
        'apple' => 'Continue with Apple',
        'google' => 'Continue with Google',
        'github' => 'Continue with GitHub',
        'discord' => 'Continue with Discord',
    ];

    private const MIN_PASSWORD = 10;

    private const MAX_PASSWORD = 256;

    private const MAX_EMAIL = 320;

    private const MAX_NAME = 100;

    /** Local part @ domain . TLD (≥ 2) — the rule the SDK's email fields use. */
    private const EMAIL_PATTERN = '/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u';

    /**
     * Where to go after signing in (`/my-account?next=/quiz-invite/…`): a
     * path on this site, or null. One leading `/` (not `//` or `/\`), no
     * backslashes or control characters, at most 512 characters.
     */
    public static function safeNext(mixed $raw): ?string
    {
        if (! is_string($raw) || $raw === '' || strlen($raw) > 512 || ! str_starts_with($raw, '/') || str_starts_with($raw, '//')) {
            return null;
        }

        return preg_match('/[\\\\\x00-\x1f\x7f]/', $raw) ? null : $raw;
    }

    /** `{name}` → the business's name, `{email}` → where a code went. */
    public static function fill(string $template, array $values): string
    {
        foreach ($values as $key => $value) {
            $template = str_replace('{'.$key.'}', (string) $value, $template);
        }

        return $template;
    }

    /**
     * What's wrong with one box, or null. `$step` matters for the password:
     * signing in only needs one, a new account needs BD's 10-character minimum.
     */
    public static function problem(string $field, string $value, string $step): ?string
    {
        switch ($field) {
            case 'firstName':
            case 'lastName':
                return self::length(trim($value)) > self::MAX_NAME ? self::WORDS['nameTooLong'] : null;
            case 'email':
                $email = trim($value);
                if ($email === '') {
                    return self::WORDS['enterEmail'];
                }

                return self::length($email) > self::MAX_EMAIL || ! preg_match(self::EMAIL_PATTERN, $email)
                    ? self::WORDS['invalidEmail']
                    : null;
            case 'password':
                if ($step === 'signIn') {
                    if ($value === '') {
                        return self::WORDS['enterPassword'];
                    }

                    return self::length($value) > self::MAX_PASSWORD ? self::WORDS['passwordTooLong'] : null;
                }

                return self::newPasswordProblem($value);
            case 'newPassword':
                return self::newPasswordProblem($value);
            case 'code':
                return preg_match('/^[0-9]{6}$/', $value) ? null : self::WORDS['enterCode'];
        }

        return null;
    }

    private static function newPasswordProblem(string $value): ?string
    {
        if (self::length($value) < self::MIN_PASSWORD) {
            return self::WORDS['passwordTooShort'];
        }

        return self::length($value) > self::MAX_PASSWORD ? self::WORDS['passwordTooLong'] : null;
    }

    /** Lengths as JavaScript counts them (UTF-16), so both sides agree. */
    private static function length(string $text): int
    {
        return intdiv(strlen(mb_convert_encoding($text, 'UTF-16LE', 'UTF-8')), 2);
    }

    /**
     * BD's answers that are about one box go under that box.
     *
     * @param  array<int, string>  $shown
     */
    public static function fieldFor(string $code, array $shown): ?string
    {
        $candidates = match ($code) {
            'weak_password', 'password_too_short' => ['newPassword', 'password'],
            'invalid_code', 'code_expired' => ['code'],
            'invalid_email' => ['email'],
            default => [],
        };
        foreach ($candidates as $field) {
            if (in_array($field, $shown, true)) {
                return $field;
            }
        }

        return null;
    }

    /**
     * A business's two colours as the screen uses them, as CSS variables: the
     * button keeps the primary as set, with readable text on it; links use the
     * secondary (the primary when there's none), nudged only as far as it
     * takes to read at 4.5:1 on a light and on a dark page. '' when there's no
     * primary.
     */
    public static function paletteStyle(mixed $primary, mixed $secondary): string
    {
        $accent = self::normalize($primary);
        if ($accent === null) {
            return '';
        }
        $linkBase = self::normalize($secondary) ?? $accent;
        $onAccent = self::contrast($accent, '#ffffff') >= self::contrast($accent, '#111827') ? '#ffffff' : '#111827';

        $vars = [
            '--bd-sign-in-accent' => $accent,
            '--bd-sign-in-on-accent' => $onAccent,
            '--bd-sign-in-link' => self::legible($linkBase, '#ffffff', 4.5),
            '--bd-sign-in-link-dark' => self::legible($linkBase, '#111827', 4.5),
            '--bd-sign-in-ring-light' => self::legible($accent, '#ffffff', 3),
            '--bd-sign-in-ring-dark' => self::legible($accent, '#111827', 3),
        ];

        return implode(';', array_map(fn ($name, $value) => "{$name}:{$value}", array_keys($vars), $vars));
    }

    /** `#abc` / `#AABBCC` → `#aabbcc`; anything else → null. */
    public static function normalize(mixed $raw): ?string
    {
        if (! is_string($raw)) {
            return null;
        }
        $color = strtolower(trim($raw));
        if (preg_match('/^#[0-9a-f]{6}$/', $color)) {
            return $color;
        }
        if (preg_match('/^#([0-9a-f])([0-9a-f])([0-9a-f])$/', $color, $m)) {
            return '#'.$m[1].$m[1].$m[2].$m[2].$m[3].$m[3];
        }

        return null;
    }

    /** @return array<int, int> */
    private static function channels(string $hex): array
    {
        return [hexdec(substr($hex, 1, 2)), hexdec(substr($hex, 3, 2)), hexdec(substr($hex, 5, 2))];
    }

    private static function luminance(string $hex): float
    {
        [$r, $g, $b] = array_map(function (int $value): float {
            $c = $value / 255;

            return $c <= 0.03928 ? $c / 12.92 : (($c + 0.055) / 1.055) ** 2.4;
        }, self::channels($hex));

        return 0.2126 * $r + 0.7152 * $g + 0.0722 * $b;
    }

    /** WCAG contrast ratio of two `#rrggbb` colours (1–21). */
    public static function contrast(string $a, string $b): float
    {
        $la = self::luminance($a);
        $lb = self::luminance($b);

        return (max($la, $lb) + 0.05) / (min($la, $lb) + 0.05);
    }

    private static function mix(string $hex, string $toward, float $t): string
    {
        $from = self::channels($hex);
        $to = self::channels($toward);
        $out = '#';
        foreach ([0, 1, 2] as $i) {
            // Half away from zero, like JavaScript's Math.round for these values.
            $out .= str_pad(dechex((int) round($from[$i] + ($to[$i] - $from[$i]) * $t)), 2, '0', STR_PAD_LEFT);
        }

        return $out;
    }

    /** Darkened (light surface) or lightened (dark one) just enough to read. */
    private static function legible(string $hex, string $surface, float $min): string
    {
        $toward = self::luminance($surface) > 0.5 ? '#000000' : '#ffffff';
        for ($step = 0; $step <= 40; $step++) {
            $candidate = self::mix($hex, $toward, $step / 40);
            if (self::contrast($candidate, $surface) >= $min) {
                return $candidate;
            }
        }

        return $toward;
    }
}
