<?php

namespace App\Bd\Forms;

use Illuminate\Support\Str;
use stdClass;

/**
 * The bundled sample form (resources/forms/demo-form.json), shown before BD
 * is connected: everything is checked here and nothing is sent.
 */
final class SampleBackend implements Backend
{
    /** The sample's slug: `/forms/demo`, and the contact section until BD is connected. */
    public const SLUG = 'demo';

    public function schema(string $form): Schema
    {
        $schema = Schema::fromJson(Json::decode((string) file_get_contents(resource_path('forms/demo-form.json'))));

        return $schema->with(
            slug: self::SLUG,
            description: 'A sample form bundled with the starter, checked here and never sent. '
                .'Set BD_CONTACT_FORM and your BD keys to show one of your own.',
        );
    }

    public function submit(string $form, Submission $submission): SubmitResult
    {
        return SubmitResult::success(200, null, true);
    }

    public function upload(string $form, string $fieldId, PickedFile $file): stdClass
    {
        return Json::objectFrom([
            'storageId' => 'demo-'.Str::uuid(),
            'url' => '',
            'name' => $file->name,
            'mimeType' => $file->mimeType,
            'size' => (float) $file->size,
        ]);
    }

    public function collectionOptions(string $form, string $fieldId): array
    {
        return [];
    }
}
