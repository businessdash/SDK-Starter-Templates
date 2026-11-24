<?php

namespace App\Livewire;

use App\Bd\Bd;
use App\Bd\CustomerAnswer;
use App\Bd\CustomerAuth;
use App\Bd\SignInCore as Core;
use Illuminate\Contracts\View\View;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\Crypt;
use Livewire\Attributes\Locked;
use Livewire\Component;

/**
 * The business's sign-in screen on /my-account, as a Livewire component.
 *
 * The same screen every BD starter shows (`<BdSignIn>`, the Swift app's
 * `BdSignInView`, Kotlin's `:bd-sign-in`): the business's logo, name and brand
 * colours, email and password, a new account confirmed by a 6-digit emailed
 * code, a forgotten password reset by code, and "Continue with Google / Apple
 * / GitHub / Discord". Words, checks and colours are `App\Bd\SignInCore` (a
 * port of `@businessdash/sdk/sign-in-core`); the markup and
 * `public/bd-sign-in.css` are the SDK screen's.
 *
 * Nothing here signs anyone in by itself: every step is
 * `CustomerAuth::forward` — BD's `auth/customer/*`, which runs it through
 * WorkOS. "Continue with …" is a plain link to
 * `/api/bd-auth/customer/oauth/{provider}`.
 *
 *  - Leaving a box you typed in checks it; a box marked wrong is checked
 *    again as you type, until it's right.
 *  - The button checks every box first and sends nothing until they're
 *    right. BD's answers about a box (a weak password, a wrong code) land
 *    under it; the rest above the button.
 *  - Six digits in the code box send it.
 *
 * A finished sign-in sets the httpOnly `bd_session` cookie on Livewire's own
 * response (queued, like any cookie in a `web` request) and reloads
 * /my-account. The code step's details — the pending id, and the password a
 * resend needs — travel sealed with APP_KEY, never readable by the page.
 */
class SignIn extends Component
{
    private const EMPTY = ['firstName' => '', 'lastName' => '', 'email' => '', 'password' => '', 'code' => '', 'newPassword' => ''];

    #[Locked]
    public string $step = 'signIn';

    /** What's typed in each box. */
    public array $values = self::EMPTY;

    /** Box → what's wrong with it. */
    #[Locked]
    public array $wrong = [];

    /** Above the button: what went wrong that isn't about one box. */
    #[Locked]
    public ?string $problem = null;

    #[Locked]
    public ?string $notice = null;

    /** The code step: why a code was sent (signUp, reset, verify) and where to. */
    #[Locked]
    public ?string $purpose = null;

    #[Locked]
    public ?string $codeEmail = null;

    /** The rest of the code step, sealed. */
    #[Locked]
    public ?string $sealed = null;

    /** Where to go once signed in (`/my-account?next=…`): a path on this site. */
    #[Locked]
    public ?string $next = null;

    public function mount(string $start = 'signIn', ?string $problem = null, ?string $next = null): void
    {
        $this->step = $start === 'createAccount' ? 'createAccount' : 'signIn';
        // Back from a provider that didn't finish.
        $this->problem = $problem;
        $this->next = Core::safeNext($next);
    }

    /**
     * A box the page sent: when it's left after typing, or as it's typed in
     * while marked wrong (so the message goes the moment it's right, and
     * never appears early), and with the button.
     */
    public function updatedValues(mixed $value, string $field): void
    {
        if (! array_key_exists($field, self::EMPTY)) {
            unset($this->values[$field]);

            return;
        }
        $value = is_string($value) ? $value : '';
        $this->values[$field] = $field === 'code' ? substr(preg_replace('/[^0-9]/', '', $value), 0, 6) : $value;

        if (in_array($field, $this->fields(), true)) {
            $this->mark($field, $this->check($field));
        }
    }

    public function submit(): void
    {
        $this->problem = null;
        $this->notice = null;

        $wrong = [];
        foreach ($this->fields() as $field) {
            if ($message = $this->check($field)) {
                $wrong[$field] = $message;
            }
        }
        $this->wrong = $wrong;
        if ($wrong) {
            $this->focus(array_key_first($wrong));

            return;
        }

        match ($this->step) {
            'createAccount' => $this->createAccount(),
            'forgot' => $this->forgot(),
            'code' => $this->verify(),
            default => $this->signIn(),
        };
    }

    public function go(string $to): void
    {
        if (in_array($to, ['signIn', 'createAccount', 'forgot'], true)) {
            $this->moveTo($to, $to === 'createAccount' ? 'firstName' : 'email');
        }
    }

    public function resend(): void
    {
        $pending = $this->unseal();
        if ($this->step !== 'code' || ! $pending) {
            return;
        }
        $this->problem = null;

        $answer = match ($this->purpose) {
            'signUp' => $this->forward('sign-up', array_intersect_key($pending, array_flip(['email', 'password', 'firstName', 'lastName']))),
            'verify' => $this->forward('sign-in', ['email' => $pending['email'], 'password' => $pending['password']]),
            default => $this->forward('forgot-password', ['email' => $pending['email']]),
        };
        unset($pending['pendingId']);

        $answer->isAnswered()
            ? $this->toCode($answer, $this->purpose, $pending, Core::WORDS['codeResent'])
            : $this->finish($answer);
    }

    // ── Steps ────────────────────────────────────────────────────────────────

    private function signIn(): void
    {
        $details = ['email' => $this->email(), 'password' => $this->values['password']];
        $answer = $this->forward('sign-in', $details);

        // An answer without a session: WorkOS wants the email confirmed first, and has sent a code.
        $answer->isAnswered() ? $this->toCode($answer, 'verify', $details) : $this->finish($answer);
    }

    private function createAccount(): void
    {
        $details = array_filter([
            'email' => $this->email(),
            'password' => $this->values['password'],
            'firstName' => trim($this->values['firstName']),
            'lastName' => trim($this->values['lastName']),
        ], fn ($value) => $value !== '');
        $answer = $this->forward('sign-up', $details);

        $answer->isAnswered() ? $this->toCode($answer, 'signUp', $details) : $this->finish($answer);
    }

    private function forgot(): void
    {
        $details = ['email' => $this->email()];
        $answer = $this->forward('forgot-password', $details);

        $answer->isAnswered() ? $this->toCode($answer, 'reset', $details) : $this->finish($answer);
    }

    private function verify(): void
    {
        $pending = $this->unseal();
        if (! $pending) {
            $this->moveTo('signIn', 'email');
            $this->problem = 'That code has expired. Start again.';

            return;
        }
        $body = ['pendingId' => $pending['pendingId'], 'code' => $this->values['code']];
        if ($this->purpose === 'reset') {
            $body['newPassword'] = $this->values['newPassword'];
        }
        $answer = $this->forward('verify', $body);

        $this->finish($answer->isAnswered() ? CustomerAnswer::refused(502, 'unavailable', CustomerAuth::UNAVAILABLE) : $answer);
    }

    private function toCode(CustomerAnswer $answer, string $purpose, array $details, ?string $notice = null): void
    {
        $id = $answer->pendingId();
        if (! $id) {
            $this->finish(CustomerAnswer::refused(502, 'unavailable', CustomerAuth::UNAVAILABLE));

            return;
        }
        $this->moveTo('code', 'code');
        $this->purpose = $purpose;
        $this->codeEmail = $details['email'];
        $this->sealed = Crypt::encryptString(json_encode($details + ['pendingId' => $id]));
        $this->notice = $notice;
    }

    private function finish(CustomerAnswer $answer): void
    {
        if ($answer->isSignedIn()) {
            Cookie::queue(CustomerAuth::sessionCookie(request(), $answer->token, $answer->expiresAt));
            $this->values = self::EMPTY;
            $this->sealed = null;
            $this->redirect($this->next ?? route('portal'));

            return;
        }

        $field = $answer->code ? Core::fieldFor($answer->code, $this->fields()) : null;
        if ($field) {
            $this->wrong[$field] = $answer->message;
            $this->focus($field);
        } else {
            $this->problem = $answer->message ?? CustomerAuth::UNAVAILABLE;
        }
    }

    private function moveTo(string $step, string $focus): void
    {
        $this->step = $step;
        if ($step !== 'code') {
            $this->purpose = null;
            $this->codeEmail = null;
            $this->sealed = null;
        }
        $this->wrong = [];
        $this->problem = null;
        $this->notice = null;
        $this->values = array_merge($this->values, ['password' => '', 'code' => '', 'newPassword' => '']);
        $this->focus($focus);
    }

    private function forward(string $path, array $body): CustomerAnswer
    {
        return CustomerAuth::forward(Bd::client(), $path, $body);
    }

    /** @return array<string, string>|null */
    private function unseal(): ?array
    {
        try {
            $pending = json_decode(Crypt::decryptString((string) $this->sealed), true);
        } catch (\Throwable) {
            return null;
        }

        return is_array($pending) && is_string($pending['pendingId'] ?? null) && is_string($pending['email'] ?? null)
            ? $pending
            : null;
    }

    // ── Boxes and checks ─────────────────────────────────────────────────────

    /** @return array<int, string> */
    private function fields(): array
    {
        return match ($this->step) {
            'createAccount' => ['firstName', 'lastName', 'email', 'password'],
            'forgot' => ['email'],
            'code' => $this->purpose === 'reset' ? ['code', 'newPassword'] : ['code'],
            default => ['email', 'password'],
        };
    }

    private function check(string $field): ?string
    {
        return Core::problem($field, (string) ($this->values[$field] ?? ''), $this->step);
    }

    private function mark(string $field, ?string $message): void
    {
        if ($message === null) {
            unset($this->wrong[$field]);
        } else {
            $this->wrong[$field] = $message;
        }
    }

    private function email(): string
    {
        return trim((string) $this->values['email']);
    }

    private function focus(string $field): void
    {
        $this->dispatch('bd-sign-in-focus', id: 'bd-sign-in-'.$field);
    }

    // ── The screen ───────────────────────────────────────────────────────────

    public function render(): View
    {
        $options = $this->options();

        return view('livewire.sign-in', [
            'options' => $options,
            'texts' => $this->texts($options),
            'rows' => $this->rows(),
            'marks' => self::MARKS,
        ]);
    }

    /** The boxes, first and last name sharing a row, with what each input needs. */
    private function rows(): array
    {
        $autoSend = $this->step === 'code' && $this->purpose !== 'reset';
        $boxes = array_map(fn (string $field) => [
            'field' => $field,
            'label' => Core::LABELS[$field],
            'type' => match ($field) {
                'email' => 'email',
                'password', 'newPassword' => 'password',
                default => 'text',
            },
            'autocomplete' => match ($field) {
                'firstName' => 'given-name',
                'lastName' => 'family-name',
                'email' => 'email',
                'password' => $this->step === 'createAccount' ? 'new-password' : 'current-password',
                'code' => 'one-time-code',
                'newPassword' => 'new-password',
            },
            'inputmode' => match ($field) {
                'email' => 'email',
                'code' => 'numeric',
                default => null,
            },
            // Six digits send the code (a reset waits for the new password).
            'autoSend' => $field === 'code' && $autoSend,
        ], $this->fields());

        return $boxes[0]['field'] === 'firstName'
            ? [[$boxes[0], $boxes[1]], ...array_map(fn ($box) => [$box], array_slice($boxes, 2))]
            : array_map(fn ($box) => [$box], $boxes);
    }

    private function texts(array $options): array
    {
        $w = Core::WORDS;
        $name = $options['name'];

        return match ($this->step) {
            'createAccount' => [
                'title' => $name ? Core::fill($w['createTitle'], ['name' => $name]) : $w['createTitleNoName'],
                'subtitle' => $name ? Core::fill($w['createSubtitle'], ['name' => $name]) : $w['createSubtitleNoName'],
                'primary' => $w['createAccount'],
                'hint' => $w['passwordRule'],
                'links' => [['signIn', $w['haveAccount']]],
            ],
            'forgot' => [
                'title' => $w['forgotTitle'],
                'subtitle' => $w['forgotSubtitle'],
                'primary' => $w['sendCode'],
                'hint' => null,
                'links' => [['signIn', $w['backToSignIn']]],
            ],
            'code' => [
                'title' => $w['codeTitle'],
                'subtitle' => Core::fill(
                    $this->purpose === 'reset' ? $w['codeResetSubtitle'] : $w['codeSubtitle'],
                    ['email' => (string) $this->codeEmail],
                ),
                'primary' => $w['confirm'],
                'hint' => $this->purpose === 'reset' ? $w['passwordRule'] : null,
                'links' => [['resend', $w['resendCode']], ['signIn', $w['backToSignIn']]],
            ],
            default => [
                'title' => $name ? Core::fill($w['signInTitle'], ['name' => $name]) : $w['signInTitleNoName'],
                'subtitle' => 'Sign in to see your jobs and invoices.',
                'primary' => $w['signIn'],
                'hint' => null,
                'links' => $options['password']
                    ? [['forgot', $w['forgotPassword']], ['createAccount', $w['noAccount']]]
                    : [],
            ],
        };
    }

    /** BD's options for the screen (name, logo, colours, providers), for a minute. */
    private function options(): array
    {
        try {
            $hit = Cache::get('bd:sign-in-options');
        } catch (\Throwable) {
            $hit = null;
        }
        if (is_array($hit)) {
            return $hit;
        }

        $answer = CustomerAuth::forward(Bd::client(), 'options');
        if (! $answer->isAnswered()) {
            return ['name' => null, 'password' => true, 'oauth' => [], 'style' => '', 'logoUrl' => null];
        }
        $body = $answer->body;
        $name = is_string($body['name'] ?? null) ? trim($body['name']) : '';
        $logo = $body['logoUrl'] ?? null;
        $options = [
            'name' => $name !== '' ? $name : null,
            'password' => ($body['password'] ?? true) !== false,
            'oauth' => array_values(array_filter(Core::PROVIDERS, fn ($id) => in_array($id, (array) ($body['oauth'] ?? []), true))),
            'style' => Core::paletteStyle($body['primaryColor'] ?? null, $body['secondaryColor'] ?? null),
            'logoUrl' => is_string($logo) && str_starts_with($logo, 'https://') ? $logo : null,
        ];
        try {
            Cache::put('bd:sign-in-options', $options, 60);
        } catch (\Throwable) {
            // No cache store: ask BD each time.
        }

        return $options;
    }

    /** The providers' marks, exactly as the SDK screen draws them. */
    private const MARKS = [
        'apple' => '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.6 1.1 8.75.73 1.05 1.6 2.24 2.73 2.2 1.1-.05 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.4 1.2-2.46-.03-.01-2.3-.88-2.32-3.5zM14.2 6.13c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.3-.56.64-1.05 1.67-.92 2.66.97.08 1.96-.49 2.56-1.2z"/></svg>',
        'github' => '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.17 1.18a10.9 10.9 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z"/></svg>',
        'discord' => '<svg viewBox="0 0 24 24" aria-hidden="true" fill="#5865F2"><path d="M20.32 4.37A19.8 19.8 0 0 0 15.39 2.8a13.7 13.7 0 0 0-.63 1.29 18.4 18.4 0 0 0-5.52 0 13 13 0 0 0-.64-1.29 19.7 19.7 0 0 0-4.93 1.53C.53 9.05-.32 13.6.1 18.09a19.9 19.9 0 0 0 6.04 3.05c.49-.66.92-1.36 1.29-2.1a12.9 12.9 0 0 1-2.03-.97l.5-.38a14.2 14.2 0 0 0 12.2 0l.5.38c-.65.38-1.33.71-2.04.97.37.74.8 1.44 1.29 2.1a19.9 19.9 0 0 0 6.05-3.05c.5-5.2-.84-9.71-3.58-13.72zM8.02 15.33c-1.18 0-2.16-1.09-2.16-2.42s.96-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.33-.96 2.42-2.16 2.42zm7.96 0c-1.18 0-2.16-1.09-2.16-2.42s.96-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.33-.95 2.42-2.16 2.42z"/></svg>',
        'google' => '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.81z"/><path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.28a12 12 0 0 0 0 10.76l4.01-3.1z"/><path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.28 6.62l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77z"/></svg>',
    ];
}
