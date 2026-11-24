<?php

namespace App\Bd\Forms;

use App\Bd\Client;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use stdClass;
use Throwable;

/**
 * BD's quizzes (`/api/package/v1/quizzes/…`) with this server's secret key,
 * as the visitor when they're signed in (an invitation can require the
 * invited account).
 */
final class Quizzes
{
    public function __construct(
        private readonly string $endpoint,
        private readonly string $apiKey,
        private readonly string $origin,
        private readonly ?string $sessionToken = null,
    ) {}

    /** From `config/bd.php`, or null until BD_API_KEY and BD_SITE_ID are set. */
    public static function fromConfig(?string $sessionToken = null): ?self
    {
        $host = config('bd.host');
        $key = config('bd.api_key');
        if (! $host || ! $key || ! config('bd.site_id')) {
            return null;
        }

        return new self(rtrim($host, '/').'/api/package/v1/quizzes', $key, (string) config('bd.site_origin'), $sessionToken ?: null);
    }

    private function http(): PendingRequest
    {
        $headers = [
            'Accept' => 'application/json',
            'Origin' => $this->origin,
            'X-BD-Client' => Client::clientHeader(),
        ];
        if ($this->sessionToken !== null) {
            $headers['X-BD-Session-Token'] = $this->sessionToken;
        }

        return Http::withToken($this->apiKey)->withHeaders($headers)->timeout(15);
    }

    /** @param  list<string>  $parts  Path segments, each escaped as one. */
    private function send(array $parts, string $method = 'GET', ?stdClass $body = null): mixed
    {
        $url = $this->endpoint.'/'.implode('/', array_map('rawurlencode', $parts));
        try {
            $request = $this->http();
            if ($body !== null) {
                $request = $request->withBody(Json::encode($body), 'application/json');
            }
            $response = $request->send($method, $url);
        } catch (ConnectionException) {
            throw new FormsError('Could not reach BD.');
        }
        try {
            $json = Json::decode($response->body());
        } catch (Throwable) {
            $json = null;
        }
        if (! $response->successful()) {
            throw new FormsError(Json::str(Json::get($json, 'message')) ?? "BD returned {$response->status()}.", $response->status());
        }
        if (! $json instanceof stdClass) {
            throw new FormsError('BD sent something unexpected.');
        }

        return $json;
    }

    private static function startInfo(stdClass $o): array
    {
        return ['startedAt' => $o->startedAt ?? null, 'deadlineAt' => $o->deadlineAt ?? null, 'serverNow' => Json::num($o->serverNow ?? null) ?? microtime(true) * 1000];
    }

    public function invitation(string $token): stdClass
    {
        return $this->send(['invitations', $token]);
    }

    public function practice(string $slug): stdClass
    {
        return $this->send([$slug]);
    }

    public function invitationBackend(string $token): QuizBackend
    {
        return new QuizBackend(
            submit: fn (array $answers) => QuizScoring::readCompletion(
                $this->send(['invitations', $token, 'submit'], 'POST', Json::objectFrom(['answers' => Json::objectFrom($answers)]))
            ),
            start: fn () => self::startInfo($this->send(['invitations', $token, 'start'], 'POST')),
            saveDraft: function (array $answers) use ($token) {
                $this->send(['invitations', $token, 'draft'], 'POST', Json::objectFrom(['answers' => Json::objectFrom($answers)]));
            },
            lockAnswer: fn (string $fieldId, mixed $answer) => QuizScoring::readResult(
                Json::get($this->send(['invitations', $token, 'lock'], 'POST', Json::objectFrom(['fieldId' => $fieldId, 'answer' => $answer])), 'result')
            ),
        );
    }

    public function practiceBackend(string $slug): QuizBackend
    {
        return new QuizBackend(
            submit: fn (array $answers, array $questionFieldIds) => QuizScoring::readCompletion($this->send([$slug, 'score'], 'POST', Json::objectFrom([
                'answers' => Json::objectFrom($answers),
                'questionFieldIds' => $questionFieldIds,
            ]))),
            lockAnswer: fn (string $fieldId, mixed $answer) => QuizScoring::readResult(
                $this->send([$slug, 'check'], 'POST', Json::objectFrom(['fieldId' => $fieldId, 'answer' => $answer]))
            ),
        );
    }
}
