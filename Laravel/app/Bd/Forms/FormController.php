<?php

namespace App\Bd\Forms;

use Closure;
use Illuminate\Support\Str;
use stdClass;
use Throwable;

/**
 * The headless form: values, errors, steps and submission, with BD's rules
 * applied exactly as the server applies them. A port of the Swift SDK's
 * `BdFormController` (and so of the web renderer's `useForm`), run once per
 * request: the Livewire component rebuilds it from what the visitor has
 * entered, does what they asked, and draws the result.
 */
final class FormController
{
    /** @var array<string, mixed> Field id → JSON value (repeater entries nested inside). */
    public array $values = [];

    /** @var array<string, string> Field path key → message. */
    public array $errors = [];

    public int $step = 0;

    /** The visitor has tried to submit or advance: required errors show as they edit. */
    public bool $hasAttempted = false;

    public ?SubmitResult $result = null;

    /** @var array<string, array{0: string, 1: mixed}> Field id → ['loaded', options] or ['failed', message]. */
    public array $collectionOptions = [];

    /** @var array<string, PickedFile> Placeholder id → the picked file it stands for. */
    public array $pendingFiles = [];

    /** @var Closure(string, string, ?Field): string What a visitor reads for a problem. */
    public Closure $messages;

    /** @var array<string, mixed> */
    private array $seed = [];

    /** @var array<string, stdClass> */
    private array $functionsById = [];

    private array $userFunctions = [];

    /** @var list<Field> */
    private array $calcFields = [];

    /** @var array<string, Field> */
    private array $fieldIndex = [];

    public function __construct(
        public readonly Schema $schema,
        public readonly ?Backend $backend = null,
        public SubmitOptions $submitOptions = new SubmitOptions,
    ) {
        $this->messages = Messages::message(...);
        $this->adopt();
    }

    private function adopt(): void
    {
        $this->fieldIndex = Rules::fieldsById($this->schema->fields);
        $this->functionsById = [];
        $bySlug = [];
        foreach ($this->schema->businessFunctions as $def) {
            $this->functionsById[$def->id] ??= $def;
            $bySlug[Js::upper($def->slug)] ??= $def;
        }
        $this->userFunctions = Formula::userFunctions($bySlug);
        $this->calcFields = array_values(array_filter($this->fieldIndex, fn (Field $f) => $f->type === 'calculation'));
        $this->seed = $this->applyCalcs(Rules::seedInitialData($this->schema->fields));
        $this->values = $this->seed;
        $this->errors = [];
        $this->step = 0;
        $this->result = null;
        $this->hasAttempted = false;
        $this->pendingFiles = [];
        // Conditions that compare a collection record's column need the
        // records loaded before they can evaluate.
        foreach ($this->fieldIndex as $f) {
            $rule = $f->rule();
            if (is_string($rule?->matchField ?? null) && is_string($rule->fieldId ?? null)) {
                $this->loadCollectionOptions($rule->fieldId);
            }
        }
    }

    public function message(string $reason, string $label, ?Field $field): string
    {
        return ($this->messages)($reason, $label, $field);
    }

    // ── Schema ──────────────────────────────────────────────────────────────

    /** @return list<Field> */
    public function fields(): array
    {
        return $this->schema->fields;
    }

    public function field(string $id): ?Field
    {
        return $this->fieldIndex[$id] ?? null;
    }

    public function isConsecutive(): bool
    {
        return $this->schema->flag('isConsecutive') === true;
    }

    /**
     * The steps the visitor walks: one holding everything, or one per visible
     * top-level element (a condition can add or remove a page).
     *
     * @return list<list<Field>>
     */
    public function steps(): array
    {
        return Rules::computeSteps($this->fields(), $this->isConsecutive(), $this->resolver([]));
    }

    public function stepCount(): int
    {
        return max(count($this->steps()), 1);
    }

    public function currentStep(): int
    {
        return min(max($this->step, 0), $this->stepCount() - 1);
    }

    public function isFirstStep(): bool
    {
        return $this->currentStep() === 0;
    }

    public function isLastStep(): bool
    {
        return $this->currentStep() === $this->stepCount() - 1;
    }

    public function progress(): float
    {
        return ($this->currentStep() + 1) / $this->stepCount();
    }

    public function stepTitle(int $index): string
    {
        $first = $this->steps()[$index][0] ?? null;
        $title = $first?->str('stepTitle');
        if ($title !== null) {
            return $title;
        }

        return $first !== null && $first->label !== '' ? $first->label : 'Step '.($index + 1);
    }

    public function isSubmitted(): bool
    {
        return $this->result?->ok === true;
    }

    // ── Values ──────────────────────────────────────────────────────────────

    public function value(FieldPath $path): mixed
    {
        return $this->scopeValues($path->entries)[$path->fieldId] ?? null;
    }

    public function setValue(mixed $value, FieldPath $path): void
    {
        $this->values = $this->applyCalcs(self::write($value, $path, $this->values));
        $this->revalidate($path);
    }

    /** The values a field inside these repeater entries sees. */
    public function scopeValues(array $entries): array
    {
        $scope = $this->values;
        foreach ($entries as [$repeater, $index]) {
            $scope = Json::toMap((Json::list($scope[$repeater] ?? null) ?? [])[$index] ?? null);
        }

        return $scope;
    }

    private static function write(mixed $value, FieldPath $path, array $root): array
    {
        $go = function (array $scope, array $entries) use (&$go, $value, $path): array {
            if ($entries === []) {
                $scope[$path->fieldId] = $value;

                return $scope;
            }
            [$repeater, $index] = array_shift($entries);
            $list = Json::list($scope[$repeater] ?? null) ?? [];
            while (count($list) <= $index) {
                $list[] = new stdClass;
            }
            $list[$index] = Json::objectFrom($go(Json::toMap($list[$index]), $entries));
            $scope[$repeater] = $list;

            return $scope;
        };

        return $go($root, $path->entries);
    }

    private function applyCalcs(array $values): array
    {
        foreach ($this->calcFields as $f) {
            $config = $f->cfg('calculationConfig');
            if ($config === null) {
                continue;
            }
            $r = Calculation::compute($config, function (string $id) use (&$values) {
                return $values[$id] ?? null;
            }, $this->functionsById, $this->userFunctions);
            $values[$f->id] = $r['ok'] ? $r['value'] : null;
        }

        return $values;
    }

    // ── Repeaters ───────────────────────────────────────────────────────────

    /** @return list<stdClass> A repeater's entries: always at least one. */
    public function entries(FieldPath $repeater): array
    {
        $objects = array_map(
            fn ($item) => $item instanceof stdClass ? $item : new stdClass,
            Json::list($this->value($repeater)) ?? [],
        );

        return $objects ?: [new stdClass];
    }

    public function addEntry(FieldPath $repeater): void
    {
        $f = $this->field($repeater->fieldId);
        if ($f === null) {
            return;
        }
        $list = $this->entries($repeater);
        if (count($list) >= (int) (Json::num($f->config('populatorConfig', 'maxInstances')) ?? 10)) {
            return;
        }
        $list[] = new stdClass;
        $this->setValue($list, $repeater);
    }

    public function removeEntry(int $index, FieldPath $repeater): void
    {
        $list = $this->entries($repeater);
        if (! isset($list[$index]) || count($list) <= 1) {
            return;
        }
        array_splice($list, $index, 1);
        // Errors are keyed by entry index; shifting entries invalidates them.
        $prefix = $repeater->key().'[';
        $this->errors = array_filter($this->errors, fn ($key) => ! str_starts_with((string) $key, $prefix), ARRAY_FILTER_USE_KEY);
        $this->setValue($list, $repeater);
    }

    // ── Conditions ──────────────────────────────────────────────────────────

    /** What a condition compares, inside these entries. */
    public function resolver(array $entries): Closure
    {
        $scope = $entries === []
            ? Rules::withDerivedFieldValues($this->fields(), Rules::deriveReferenceValues($this->fields(), $this->values))
            : $this->scopeValues($entries);

        return Rules::resolver($scope, $this->matchResolver());
    }

    /** Is this block or page showing right now? */
    public function isVisible(Field $node, array $entries = []): bool
    {
        return Rules::isNodeVisible($node, $this->resolver($entries));
    }

    /** The children of a concurrent-reveal group shown so far. */
    public function revealCount(Field $group, array $entries = []): int
    {
        $children = $group->children ?? [];
        if ($group->bool('concurrentReveal') !== true) {
            return count($children);
        }

        return Rules::concurrentRevealCount($children, $this->scopeValues($entries));
    }

    /** A condition on a collection record's column: the picked record's value there. */
    public function matchResolver(): Closure
    {
        $options = $this->collectionOptions;

        return function (stdClass $rule, mixed $raw) use ($options) {
            $column = Json::str($rule->matchField ?? null);
            $source = Json::str($rule->fieldId ?? null);
            $loaded = $source !== null && ($options[$source][0] ?? null) === 'loaded' ? $options[$source][1] : null;
            if ($column === null || $loaded === null) {
                return $raw;
            }
            $index = [];
            foreach ($loaded as $option) {
                $index[$option['value']] ??= $option;
            }
            $one = function (mixed $v) use ($index, $column) {
                $option = $index[Js::string($v)] ?? null;
                if ($option === null) {
                    return $v;
                }
                if ($column === '__label__') {
                    return $option['label'];
                }

                return $option['match'][$column] ?? $v;
            };
            if (Json::isList($raw)) {
                return implode(', ', array_map(fn ($v) => Js::string($one($v)), $raw));
            }

            return $raw === null || $raw instanceof Undefined ? $raw : $one($raw);
        };
    }

    // ── Validation ──────────────────────────────────────────────────────────

    public function error(FieldPath $path): ?string
    {
        return $this->errors[$path->key()] ?? null;
    }

    /**
     * Required and value problems within these nodes, keyed by path.
     *
     * @param  list<Field>  $nodes
     * @return array<string, string>
     */
    public function problems(array $nodes): array
    {
        $out = [];
        $match = $this->matchResolver();
        foreach (Rules::findMissingRequired($nodes, $this->values, $match) as $m) {
            $out[$m['path']] = $this->message('required', $m['label'], $this->field($m['id']));
        }
        foreach (Rules::findInvalidValues($nodes, $this->values, $match) as $bad) {
            $out[$bad['path']] ??= $this->message($bad['reason'], $bad['label'], $this->field($bad['id']));
        }

        return $out;
    }

    /** Check one field now (on blur): a format problem shows at once, a missing answer once they've tried to move on. */
    public function validate(FieldPath $path): void
    {
        $f = $this->field($path->fieldId);
        if ($f === null) {
            return;
        }
        $value = $this->scopeValues($path->entries)[$path->fieldId] ?? null;
        $problem = null;
        $reason = Rules::isPendingUpload($value) ? null : (Rules::validateValue($f, $value) ?? Rules::clientOnlyRule($f, $value));
        if ($reason !== null) {
            $problem = $this->message($reason, $f->label, $f);
        } elseif ($this->hasAttempted && ($f->required || $f->mustBeTrue())
            && ! in_array($f->type, Rules::STATIC_OR_LAYOUT, true) && Rules::isEmpty($f, $value)) {
            $problem = $this->message('required', $f->label, $f);
        }
        if ($problem === null) {
            unset($this->errors[$path->key()]);
        } else {
            $this->errors[$path->key()] = $problem;
        }
    }

    /** After an edit: clear a fixed error, refresh one still wrong, and keep either/or and repeater errors in step. */
    private function revalidate(FieldPath $path): void
    {
        if (isset($this->errors[$path->key()])) {
            $this->validate($path);
        }
        if (! $this->hasAttempted) {
            return;
        }
        $current = $this->problems($this->fields());
        foreach (array_keys($this->errors) as $key) {
            $key = (string) $key;
            if (isset($current[$key])) {
                continue;
            }
            $parts = explode('.', $key);
            $f = $this->field(end($parts));
            if ($f !== null && ($f->type === 'or_condition' || $f->type === 'multi_populator')) {
                unset($this->errors[$key]);
            }
        }
    }

    /** Check the whole form and show every problem. True when clean. */
    public function validateAll(): bool
    {
        $this->hasAttempted = true;
        $this->errors = $this->problems($this->fields());

        return $this->errors === [];
    }

    // ── Navigation ──────────────────────────────────────────────────────────

    /** Advance if the current step is complete; otherwise show what's missing. */
    public function next(): bool
    {
        $all = $this->steps();
        $index = $this->currentStep();
        if ($index >= count($all) - 1) {
            return false;
        }
        $this->hasAttempted = true;
        $found = $this->problems($all[$index]);
        if ($found !== []) {
            $this->errors = $found;

            return false;
        }
        $this->errors = [];
        $this->step = $index + 1;

        return true;
    }

    public function back(): void
    {
        if ($this->currentStep() > 0) {
            $this->step = $this->currentStep() - 1;
            $this->errors = [];
        }
    }

    public function goToStep(int $index): void
    {
        $this->step = min(max($index, 0), $this->stepCount() - 1);
    }

    // ── Files ───────────────────────────────────────────────────────────────

    /**
     * Add picked files to a `file_upload` field. A file the field doesn't take
     * is refused with a message; the rest upload on submit.
     *
     * @param  array<string, PickedFile>  $files  Placeholder id → file.
     * @return list<string> The ids taken.
     */
    public function addFiles(array $files, FieldPath $path): array
    {
        $f = $this->field($path->fieldId);
        if ($f === null) {
            return [];
        }
        $list = Json::list($this->value($path)) ?? [];
        $maxFiles = (int) (Json::num($f->config('fileConfig', 'maxFiles')) ?? 1);
        $allowed = Json::list($f->config('fileConfig', 'allowedTypes'));
        $maxMB = Json::num($f->config('fileConfig', 'maxSize'));
        $problem = null;
        $taken = [];
        foreach ($files as $id => $file) {
            if (count($list) >= $maxFiles) {
                $problem = $this->message('max', $f->label, $f);
                break;
            }
            $why = Rules::fileProblem($file->name, $file->mimeType, $file->size, $allowed, $maxMB);
            if ($why !== null) {
                $problem = $why;

                continue;
            }
            $list[] = $this->placeholder($file, $f->id, (string) $id);
            $taken[] = (string) $id;
        }
        $this->setValue($list, $path);
        if ($problem !== null) {
            $this->errors[$path->key()] = $problem;
        }

        return $taken;
    }

    public function removeFile(int $index, FieldPath $path): void
    {
        $list = Json::list($this->value($path)) ?? [];
        if (! isset($list[$index])) {
            return;
        }
        $id = Json::str(Json::get($list[$index], 'localId'));
        if ($id !== null) {
            unset($this->pendingFiles[$id]);
        }
        array_splice($list, $index, 1);
        $this->setValue($list, $path);
    }

    /** A picked file's stand-in in the values until submit uploads it. */
    public function placeholder(PickedFile $file, string $fieldId, ?string $id = null): stdClass
    {
        $id ??= (string) Str::uuid();
        $this->pendingFiles[$id] = $file;

        return Json::objectFrom([
            'pending' => true, 'localId' => $id, 'fieldId' => $fieldId,
            'name' => $file->name, 'size' => (float) $file->size, 'mimeType' => $file->mimeType,
        ]);
    }

    // ── Remote data ─────────────────────────────────────────────────────────

    public function loadCollectionOptions(string $fieldId): void
    {
        if (($this->collectionOptions[$fieldId][0] ?? null) === 'loaded') {
            return;
        }
        if ($this->backend === null) {
            $this->collectionOptions[$fieldId] = ['failed', "Options can't load without a backend."];

            return;
        }
        try {
            $this->collectionOptions[$fieldId] = ['loaded', $this->backend->collectionOptions($this->schema->slug, $fieldId)];
        } catch (Throwable) {
            $this->collectionOptions[$fieldId] = ['failed', "Couldn't load the options."];
        }
    }

    // ── Submit ──────────────────────────────────────────────────────────────

    /**
     * Validate everything, upload picked files, and submit. Never throws:
     * every outcome comes back as a result, and field problems land in `errors`.
     */
    public function submit(): SubmitResult
    {
        $this->hasAttempted = true;
        $found = $this->problems($this->fields());
        if ($found !== []) {
            return $this->fail('client_validation_failed', self::summary(count($found)), $found);
        }
        // A form-wide cap across every file field.
        $fileFields = array_filter($this->fieldIndex, fn (Field $f) => $f->type === 'file_upload');
        $total = array_sum(array_map(fn (Field $f) => count(Json::list($this->values[$f->id] ?? null) ?? []), $fileFields));
        if ($total > Rules::FORM_WIDE_MAX_FILES) {
            $e = [];
            foreach ($fileFields as $f) {
                if ((Json::list($this->values[$f->id] ?? null) ?? []) !== []) {
                    $e[$f->id] = 'At most '.Rules::FORM_WIDE_MAX_FILES.' files in total.';
                }
            }

            return $this->fail('client_validation_failed', 'Please attach at most '.Rules::FORM_WIDE_MAX_FILES.' files in total.', $e);
        }
        if ($this->backend === null) {
            return $this->fail('network_error', 'This form has no backend to submit to.', []);
        }
        $this->errors = [];

        // Upload every picked file, swapping placeholders for stored files.
        $uploadErrors = [];
        $this->values = $this->resolveUploads($this->values, '', $uploadErrors);
        if ($uploadErrors !== []) {
            return $this->fail('network_error', "Some files couldn't be uploaded. Please try again.", $uploadErrors);
        }

        $o = $this->submitOptions;
        $result = $this->backend->submit($this->schema->slug, new Submission(
            data: Rules::toSubmissionPayload($this->fields(), $this->values),
            submitterEmail: $o->submitterEmail,
            submitterName: $o->submitterName,
            dryRun: $o->dryRun ? true : null,
            source: $o->source,
            referrer: $o->referrer,
            metadata: $o->metadata,
        ));
        $this->result = $result;
        if (! $result->ok) {
            $this->errors = $this->mapIssues($result->issues);
            $this->jumpToFirstError();
        }

        return $result;
    }

    public static function summary(int $count): string
    {
        return 'Please fix the highlighted field'.($count === 1 ? '' : 's').'.';
    }

    /** @param  array<string, string>  $errors */
    private function fail(string $reason, string $message, array $errors): SubmitResult
    {
        $this->errors = $errors;
        $issues = [];
        foreach ($errors as $key => $text) {
            $parts = explode('.', (string) $key);
            $id = end($parts);
            $issues[] = [
                'fieldId' => $id,
                'label' => $this->field($id)?->label ?? $id,
                'reason' => $reason === 'client_validation_failed' ? 'invalid' : 'upload',
                'message' => $text,
            ];
        }
        $this->result = SubmitResult::failure(0, $reason, $message, $issues);
        $this->jumpToFirstError();

        return $this->result;
    }

    /** Server issues arrive by field id (or output key): map them onto field errors. */
    private function mapIssues(array $issues): array
    {
        $keyToId = [];
        foreach ($this->fieldIndex as $f) {
            if ($f->key() !== null) {
                $keyToId[$f->key()] = $f->id;
            }
        }
        $out = [];
        foreach ($issues as $issue) {
            if ($issue['fieldId'] === '') {
                continue;
            }
            $id = isset($this->fieldIndex[$issue['fieldId']]) ? $issue['fieldId'] : ($keyToId[$issue['fieldId']] ?? $issue['fieldId']);
            $f = $this->field($id);
            $out[$id] = $this->message($issue['reason'], $f?->label ?? $issue['label'], $f);
        }

        return $out;
    }

    /** In a stepped form, move to the step holding the first error. */
    private function jumpToFirstError(): void
    {
        $first = $this->orderedErrorKeys()[0] ?? null;
        if (! $this->isConsecutive() || $first === null) {
            return;
        }
        $root = explode('.', explode('[', $first)[0])[0];
        foreach ($this->steps() as $i => $step) {
            if (isset(Rules::fieldsById($step)[$root])) {
                $this->step = $i;

                return;
            }
        }
    }

    /** @return list<string> Error keys in the order their fields appear. */
    public function orderedErrorKeys(): array
    {
        $order = [];
        foreach (array_keys(Rules::fieldsById($this->fields())) as $i => $id) {
            $order[(string) $id] = $i;
        }
        $keys = array_map('strval', array_keys($this->errors));
        usort($keys, function (string $a, string $b) use ($order) {
            $ra = $order[explode('[', $a)[0]] ?? PHP_INT_MAX;
            $rb = $order[explode('[', $b)[0]] ?? PHP_INT_MAX;

            return $ra !== $rb ? $ra <=> $rb : strcmp($a, $b);
        });

        return $keys;
    }

    private function resolveUploads(array $scope, string $prefix, array &$errors): array
    {
        $out = $scope;
        foreach ($scope as $key => $value) {
            $key = (string) $key;
            $f = $this->field($key);
            if ($f === null) {
                continue;
            }
            switch ($f->type) {
                case 'file_upload':
                    $list = Json::list($value);
                    if ($list === null) {
                        break;
                    }
                    $done = [];
                    foreach ($list as $item) {
                        $id = Rules::isPendingUpload($item) ? $item->localId : null;
                        $file = $id !== null ? ($this->pendingFiles[$id] ?? null) : null;
                        if ($file === null) {
                            $done[] = $item;

                            continue;
                        }
                        try {
                            $done[] = $this->backend->upload($this->schema->slug, $f->id, $file);
                            unset($this->pendingFiles[$id]);
                        } catch (Throwable $e) {
                            $errors[$prefix.$key] = $e instanceof FormsError ? $e->getMessage() : "Couldn't upload {$file->name}.";
                            $done[] = $item;
                        }
                    }
                    $out[$key] = $done;
                    break;
                case 'multi_populator':
                    $list = Json::list($value);
                    if ($list === null) {
                        break;
                    }
                    $out[$key] = array_map(
                        fn ($i) => $list[$i] instanceof stdClass
                            ? Json::objectFrom($this->resolveUploads(get_object_vars($list[$i]), "{$prefix}{$key}[{$i}].", $errors))
                            : $list[$i],
                        array_keys($list),
                    );
                    break;
            }
        }

        return $out;
    }
}
