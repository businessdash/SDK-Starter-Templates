<?php

namespace App\Biab\Resources;

use App\Biab\Client;

/**
 * The Front Desk chatbot.
 *
 * ## Sessions, and why the token matters
 *
 * A chat is a `sessionToken`, not a user. `session()` mints an anonymous one
 * for a visitor who has not signed in; `persistedSession()` resumes a token the
 * browser already holds so a reload does not lose the conversation. Everything
 * else takes that token.
 *
 * Losing the token loses the thread — there is no other handle on it — so store
 * it before rendering the first message, not after.
 *
 * ## Escalation is a request, not a transfer
 *
 * `requestHuman()` asks the org for a person. It does not connect one: staff
 * may be offline, and the org decides. Check `availability()` first if you want
 * to show the option only when someone can actually answer — offering "talk to
 * a human" at 2am and delivering silence is worse than not offering it.
 */
class Chatbot
{
    public function __construct(
        private readonly Client $client,
        private readonly ?string $sessionToken = null,
    ) {
    }

    /** Widget config: greeting, branding, which features are on. */
    public function config(): array
    {
        return $this->client->get('chatbot/config', [], $this->headers());
    }

    /** Whether a human could pick up right now. */
    public function availability(): array
    {
        return $this->client->get('chatbot/availability', [], $this->headers());
    }

    /** Mint a new anonymous chat session. Store the returned token. */
    public function session(): array
    {
        return $this->client->post('chatbot/session', [], $this->headers());
    }

    /**
     * Resume the session this browser already holds.
     *
     * Pass the token the visitor arrived with; a reload otherwise starts a
     * fresh thread and the visitor repeats themselves.
     */
    public function persistedSession(string $token): array
    {
        return $this->client->post(
            'chatbot/persisted-session',
            ['sessionToken' => $token],
            $this->headers()
        );
    }

    /** Send a visitor message and get the assistant's reply. */
    public function chat(string $message, array $extra = []): array
    {
        return $this->client->post(
            'chatbot/chat',
            array_merge(['message' => $message], $extra),
            $this->headers()
        );
    }

    /** The thread so far. */
    public function messages(): array
    {
        return $this->client->get('chatbot/messages', [], $this->headers());
    }

    /**
     * Ask for a human.
     *
     * A REQUEST — staff may be offline and the org decides. Check
     * `availability()` if you want to offer this only when it can be answered.
     */
    public function requestHuman(array $input = []): array
    {
        return $this->client->post('chatbot/request-human', $input, $this->headers());
    }

    /** A form the bot can present mid-conversation. */
    public function form(string $slug): array
    {
        return $this->client->get('chatbot/forms/'.rawurlencode($slug), [], $this->headers());
    }

    public function submitForm(string $slug, array $values): array
    {
        return $this->client->post(
            'chatbot/forms/'.rawurlencode($slug),
            $values,
            $this->headers()
        );
    }

    /** @return array<string, string> */
    private function headers(): array
    {
        return $this->sessionToken
            ? ['X-BIAB-Chat-Session' => $this->sessionToken]
            : [];
    }
}
