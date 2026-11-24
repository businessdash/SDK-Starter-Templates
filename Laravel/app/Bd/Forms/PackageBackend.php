<?php

namespace App\Bd\Forms;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use stdClass;
use Throwable;

/**
 * BD's Package API (`/api/package/v1/forms/…`) with this server's secret key.
 * The key stays here: the browser only ever talks to this app.
 */
final class PackageBackend implements Backend
{
    public function __construct(
        private readonly string $endpoint,
        private readonly string $apiKey,
        private readonly string $origin,
    ) {}

    /** From `config/bd.php`, or null until BD_API_KEY and BD_SITE_ID are set. */
    public static function fromConfig(): ?self
    {
        $host = config('bd.host');
        $key = config('bd.api_key');
        if (! $host || ! $key || ! config('bd.site_id')) {
            return null;
        }

        return new self(rtrim($host, '/').'/api/package/v1', $key, (string) config('bd.site_origin'));
    }

    /** `…/forms/<slug>[/<suffix>]`: the slug is one segment, even with a "/" in it. */
    private function url(string $form, string $suffix = ''): string
    {
        return $this->endpoint.'/forms/'.rawurlencode($form).($suffix === '' ? '' : '/'.$suffix);
    }

    private function http(): PendingRequest
    {
        return Http::withToken($this->apiKey)
            ->withHeaders([
                'Accept' => 'application/json',
                // Server-to-server calls carry no browser Origin, but the
                // platform gates on it. Send the site's real public origin.
                'Origin' => $this->origin,
                'X-BD-Client' => 'laravel-forms/1',
            ])
            ->timeout(15);
    }

    /** A JSON body, encoded the way JavaScript would (`{}` stays an object, 5.0 is 5). */
    private function post(string $url, stdClass $body): Response
    {
        return $this->http()->withBody(Json::encode($body), 'application/json')->post($url);
    }

    /** The decoded body of a 2xx response; otherwise BD's message as an error. */
    private function json(Response $response): mixed
    {
        if (! $response->successful()) {
            $message = Json::str(Json::get(self::decode($response), 'message'));
            throw new FormsError($message ?? "BD returned {$response->status()}.", $response->status());
        }

        return self::decode($response);
    }

    private static function decode(Response $response): mixed
    {
        try {
            return Json::decode($response->body());
        } catch (Throwable) {
            return null;
        }
    }

    public function schema(string $form): Schema
    {
        // A minute's cache: a busy page doesn't fetch the form on every keystroke.
        $text = Cache::remember('bd.forms.schema.'.sha1($form), 60, function () use ($form) {
            try {
                $response = $this->http()->get($this->url($form));
            } catch (ConnectionException) {
                throw new FormsError('Could not reach BD to load this form.');
            }
            $this->json($response);

            return $response->body();
        });

        return Schema::fromJson(Json::decode($text));
    }

    public function submit(string $form, Submission $submission): SubmitResult
    {
        try {
            $response = $this->post($this->url($form), $submission->body());
        } catch (Throwable $e) {
            return SubmitResult::failure(0, 'network_error', 'Could not reach BD: '.$e->getMessage());
        }
        $body = self::decode($response);
        if ($response->successful()) {
            return SubmitResult::success(
                $response->status(),
                Json::str(Json::get($body, 'submissionId')),
                Json::get($body, 'dryRun') === true,
            );
        }

        return SubmitResult::fromResponse($response->status(), $body);
    }

    public function upload(string $form, string $fieldId, PickedFile $file): stdClass
    {
        try {
            $presign = $this->json($this->post($this->url($form, 'upload-url'), Json::objectFrom([
                'fieldId' => $fieldId,
                'filename' => $file->name,
                'contentType' => $file->mimeType,
                'sizeBytes' => (float) $file->size,
            ])));
            $target = Json::str(Json::get($presign, 'uploadUrl'));
            $storageId = Json::str(Json::get($presign, 'storageId'));
            if ($target === null || $storageId === null || ! filter_var($target, FILTER_VALIDATE_URL)) {
                throw new FormsError('BD returned an invalid upload URL.');
            }
            $put = Http::withBody($file->data(), $file->mimeType)->timeout(60)->put($target);
        } catch (ConnectionException) {
            throw new FormsError("Couldn't upload {$file->name}.");
        }
        if (! $put->successful()) {
            throw new FormsError("Uploading {$file->name} failed ({$put->status()}).", $put->status());
        }

        return Json::objectFrom([
            'storageId' => $storageId,
            'url' => Json::str(Json::get($presign, 'publicUrl')) ?? '',
            'name' => $file->name,
            'mimeType' => $file->mimeType,
            'size' => (float) $file->size,
        ]);
    }

    public function collectionOptions(string $form, string $fieldId): array
    {
        // A minute's cache, as for the schema: every change re-renders the form.
        $text = Cache::remember('bd.forms.options.'.sha1($form."\n".$fieldId), 60, function () use ($form, $fieldId) {
            try {
                $response = $this->http()->get($this->url($form, 'collection-options'), ['fieldId' => $fieldId]);
            } catch (ConnectionException) {
                throw new FormsError("Couldn't load the options.");
            }
            $this->json($response);

            return $response->body();
        });
        $out = [];
        foreach (Json::list(Json::get(Json::decode($text), 'options')) ?? [] as $raw) {
            $value = Json::str(Json::get($raw, 'value'));
            $label = Json::str(Json::get($raw, 'label'));
            if ($value === null || $label === null) {
                continue;
            }
            $match = Json::get($raw, 'match');
            $out[] = [
                'value' => $value,
                'label' => $label,
                'image' => Json::str(Json::get($raw, 'image')),
                'match' => $match instanceof stdClass ? array_filter(get_object_vars($match), 'is_string') : null,
            ];
        }

        return $out;
    }
}
