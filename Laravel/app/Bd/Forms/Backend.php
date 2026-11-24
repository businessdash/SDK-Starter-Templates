<?php

namespace App\Bd\Forms;

/**
 * Where a form loads from and submits to: BD's Package API with this
 * server's secret key (`PackageBackend`), or the bundled sample's stand-in
 * (`SampleBackend`).
 */
interface Backend
{
    /** @throws FormsError */
    public function schema(string $form): Schema;

    /** Never throws: every outcome, a network failure included, is a result. */
    public function submit(string $form, Submission $submission): SubmitResult;

    /**
     * Store a picked file; the submission then carries the stored file.
     *
     * @return \stdClass `{storageId, url, name, mimeType, size}`
     *
     * @throws FormsError
     */
    public function upload(string $form, string $fieldId, PickedFile $file): \stdClass;

    /**
     * The options a `collection_select` offers.
     *
     * @return list<array{value: string, label: string, image: ?string, match: ?array<string, string>}>
     *
     * @throws FormsError
     */
    public function collectionOptions(string $form, string $fieldId): array;
}
