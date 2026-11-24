<?php

namespace App\Livewire;

use App\Bd\Forms\Field;
use App\Bd\Forms\FieldPath;
use App\Bd\Forms\FormController;
use App\Bd\Forms\Forms;
use App\Bd\Forms\FormsError;
use App\Bd\Forms\FormView;
use App\Bd\Forms\Json;
use App\Bd\Forms\PickedFile;
use App\Bd\Forms\SampleBackend;
use App\Bd\Forms\SubmitOptions;
use App\Bd\Forms\Units;
use Illuminate\View\View;
use Livewire\Attributes\Locked;
use Livewire\Component;
use Livewire\Features\SupportFileUploads\TemporaryUploadedFile;
use Livewire\WithFileUploads;
use stdClass;
use Throwable;

/**
 * A BusinessDash form, drawn on this server: `<livewire:bd-form slug="…" />`.
 *
 * The same forms every BD starter renders (`<BdForm>` on the web, Swift's,
 * Kotlin's, Flutter's), run by the same engine: each request rebuilds the
 * form's controller (App\Bd\Forms\FormController, a port of forms-core) from
 * what's in the boxes, does what was asked, and draws the result. So the
 * rules (required fields, conditions, steps, calculations, the checks BD runs
 * again on submit) are the engine's, not a second copy of them.
 *
 * In the browser:
 *   • a change to any box (leaving a text box, picking a choice) re-renders
 *     the form, so conditional fields appear, calculations update and a box
 *     marked wrong clears once it's right;
 *   • Next checks the step, Back and the step dots move between steps, and
 *     Submit checks everything and sends it to BD with the server's key.
 *
 * A picked file waits in Livewire's temporary upload storage until Submit
 * uploads it, so (like the web form) an abandoned form never leaves a file on BD.
 */
class BdForm extends Component
{
    use WithFileUploads;

    #[Locked]
    public string $slug = '';

    #[Locked]
    public string $submitLabel = 'Submit';

    #[Locked]
    public int $step = 0;

    /** Path key → the problem shown there. Re-checked as values change, so a fixed box clears. */
    #[Locked]
    public array $problems = [];

    /** Form-level messages: a failed submit, a file to pick again. */
    #[Locked]
    public array $notices = [];

    #[Locked]
    public bool $submitted = false;

    /** Why the form can't show (BD not configured, the form not found). */
    #[Locked]
    public ?string $unavailable = null;

    /**
     * File field path key → its files: `['stored' => JSON]` (uploaded, after
     * a submit that failed later) or `['held' => tmp name, 'name', 'size', 'mimeType']`.
     */
    #[Locked]
    public array $attached = [];

    /** What's in the boxes. */
    public array $input = [];

    /** Livewire's uploads land here and move straight to `$attached`. */
    public array $uploads = [];

    /** This request's form, once it has run. */
    private ?FormView $view = null;

    public function mount(string $slug, ?string $submitLabel = null): void
    {
        $this->slug = $slug;
        $this->submitLabel = $submitLabel !== null && $submitLabel !== '' ? mb_substr($submitLabel, 0, 60) : 'Submit';
        $this->run('mount');
    }

    // ── What the page asks for ──────────────────────────────────────────────

    /** Enter in a box, or the primary button: Next on a step, else Submit. */
    public function enter(): void
    {
        $this->run('enter');
    }

    public function back(): void
    {
        $this->run('back');
    }

    public function goToStep(int $index): void
    {
        $this->run('step', $index);
    }

    public function addRow(string $fieldId, array $entries = []): void
    {
        if ($path = self::path($fieldId, $entries)) {
            $this->run('add-row', $path);
        }
    }

    public function removeRow(string $fieldId, array $entries, int $row): void
    {
        if ($path = self::path($fieldId, $entries)) {
            $this->run('remove-row', [$path, $row]);
        }
    }

    public function removeFile(string $fieldId, array $entries, int $index): void
    {
        if ($path = self::path($fieldId, $entries)) {
            $this->run('remove-file', [$path, $index]);
        }
    }

    /** "Fill it in again", after a submit. */
    public function again(): void
    {
        $this->reset('step', 'problems', 'notices', 'submitted', 'attached', 'input', 'uploads');
        $this->run('mount');
    }

    /** A picked file, uploaded to Livewire's temporary storage: held until Submit. */
    public function updatedUploads(mixed $value, string $slot): void
    {
        $key = FormView::slotKey(explode('.', $slot)[0]);
        foreach (is_array($value) ? $value : [$value] as $file) {
            if ($key !== null && $file instanceof TemporaryUploadedFile) {
                $this->attached[$key][] = [
                    'held' => $file->getFilename(),
                    'name' => $file->getClientOriginalName(),
                    'size' => (int) $file->getSize(),
                    'mimeType' => $file->getMimeType() ?: 'application/octet-stream',
                ];
            }
        }
        $this->uploads = [];
    }

    /** A path the page named, checked: a field id inside zero or more [repeater id, row]. */
    private static function path(string $fieldId, array $entries): ?FieldPath
    {
        $clean = [];
        foreach ($entries as $entry) {
            if (! is_array($entry) || ! is_string($entry[0] ?? null) || ! is_int($entry[1] ?? null)) {
                return null;
            }
            $clean[] = [$entry[0], $entry[1]];
        }

        return new FieldPath($fieldId, $clean);
    }

    // ── One request ─────────────────────────────────────────────────────────

    /**
     * Rebuild the form from what's in the boxes, do what was asked, and
     * write the result back into the boxes.
     */
    private function run(string $action, mixed $arg = null): void
    {
        try {
            $schema = Forms::schema($this->slug);
        } catch (Throwable $e) {
            $this->unavailable = $e instanceof FormsError ? $e->getMessage() : 'Could not load this form.';
            report($e);

            return;
        }
        $this->unavailable = null;
        $c = new FormController($schema, Forms::backend($this->slug), new SubmitOptions(source: 'laravel-starter'));
        $notices = [];
        $fileErrors = [];
        if ($action !== 'mount') {
            $adds = [];
            foreach (FormView::valueFields($c->fields()) as $field) {
                $path = new FieldPath($field->id);
                [$present, $value] = $this->read($field, $this->input, $path, $adds, $notices);
                if ($present) {
                    $c->setValue($value, $path);
                }
            }
            // One at a time, so a file the field refuses is told apart.
            foreach ($adds as [$path, $held]) {
                foreach ($held as $entry) {
                    $file = new PickedFile($entry['name'], $entry['mimeType'], $entry['size'], fn () => self::temporary($entry['held'])->get());
                    if ($c->addFiles([$entry['held'] => $file], $path) === []) {
                        self::discard($entry['held']);
                    }
                }
            }
            $fileErrors = $c->errors;
            $c->goToStep($this->step);
        }

        // collection_select options load here, before the render needs them.
        foreach (FormView::valueFields($c->fields()) as $field) {
            if ($field->type === 'collection_select') {
                $c->loadCollectionOptions($field->id);
            }
        }

        match ($action) {
            'add-row' => $c->addEntry($arg),
            'remove-row' => $c->removeEntry($arg[1], $arg[0]),
            'remove-file' => $c->removeFile($arg[1], $arg[0]),
            default => null,
        };

        $errors = [];
        switch ($action) {
            case 'mount':
                break;
            case 'back':
                $c->back();
                break;
            case 'step':
                if ($arg < $c->currentStep()) {
                    $c->goToStep($arg);
                }
                break;
            case 'enter':
                if (! $c->isLastStep() && $c->isConsecutive()) {
                    $c->next();
                    $errors = $c->errors;
                    break;
                }
                $result = $c->submit();
                $errors = $c->errors;
                if (! $result->ok && $errors === []) {
                    $notices[] = $result->message ?? 'Could not send the form. Try again.';
                }
                if ($result->ok) {
                    foreach ($c->pendingFiles as $name => $file) {
                        self::discard((string) $name);
                    }
                }
                break;
            default:
                // A change: re-check only what's already marked, so a fixed box
                // clears and an untouched one isn't scolded.
                if ($this->problems !== []) {
                    $c->validateAll();
                    $errors = array_intersect_key($c->errors, $this->problems);
                }
        }
        $errors += $fileErrors;

        $this->submitted = $c->isSubmitted();
        $this->step = $c->currentStep();
        $this->problems = $errors;
        $this->notices = $notices;
        $this->attached = [];
        $this->input = $this->write(FormView::valueFields($c->fields()), $c->scopeValues([]), [], $c);
        $this->view = new FormView(
            $c, $errors, $notices,
            formId: (string) preg_replace('/[^\p{L}\p{N}_-]/u', '-', $this->slug),
            submitLabel: $this->submitLabel,
            sample: $this->slug === SampleBackend::SLUG,
        );
    }

    private static function temporary(string $name): TemporaryUploadedFile
    {
        return TemporaryUploadedFile::createFromLivewire($name);
    }

    private static function discard(string $name): void
    {
        try {
            self::temporary($name)->delete();
        } catch (Throwable) {
        }
    }

    // ── Boxes → values ──────────────────────────────────────────────────────

    private static function number(mixed $raw): ?float
    {
        $t = trim(is_string($raw) ? $raw : (is_scalar($raw) ? (string) $raw : ''));
        if ($t === '' || ! is_numeric($t)) {
            return null;
        }
        $n = (float) $t;

        return is_finite($n) ? $n : null;
    }

    private static function text(mixed $raw): string
    {
        return is_string($raw) ? $raw : (is_int($raw) || is_float($raw) ? (string) $raw : '');
    }

    /** @return list<string> */
    private static function texts(mixed $raw): array
    {
        return is_array($raw) ? array_values(array_map(self::text(...), array_filter($raw, 'is_scalar'))) : [];
    }

    /**
     * One field's value from the boxes: [whether it's there, its value].
     *
     * @param  array  $in  The boxes in this scope (the form, or one repeater row).
     * @param  list<array{FieldPath, list<array>}>  $adds  Held files to hand the controller.
     */
    private function read(Field $f, array $in, FieldPath $path, array &$adds, array &$notices): array
    {
        if ($f->type === 'file_upload') {
            $stored = [];
            $held = [];
            foreach ($this->attached[$path->key()] ?? [] as $entry) {
                if (isset($entry['stored'])) {
                    $stored[] = Json::decode($entry['stored']);
                } elseif (isset($entry['held']) && self::temporary($entry['held'])->exists()) {
                    $held[] = $entry;
                } else {
                    $notices[] = ($entry['name'] ?? 'A file').' waited too long; pick it again.';
                }
            }
            if ($held !== []) {
                $adds[] = [$path, $held];
            }

            return [true, $stored];
        }
        if (! array_key_exists($f->id, $in)) {
            return [false, null];
        }
        $raw = $in[$f->id];
        $part = fn (string $p) => self::text(is_array($raw) ? ($raw[$p] ?? '') : '');
        $object = fn (array $parts) => Json::objectFrom(array_combine($parts, array_map($part, $parts)));

        switch ($f->type) {
            case 'checkbox':
                return [true, self::texts($raw)];
            case 'boolean':
                return [true, $raw === true || $raw === 'true' || $raw === '1' || $raw === 1];
            case 'number':
            case 'currency':
            case 'stepper':
                return [true, self::number($raw)];
            case 'slider':
            case 'star_rating':
            case 'happiness_rating':
                $n = self::number($raw);

                return [$n !== null, $n];
            case 'choice_cards':
            case 'collection_select':
                return [true, $f->isMulti() ? self::texts($raw) : self::text($raw)];
            case 'tags':
                return [true, array_values(array_filter(array_map('trim', explode(',', self::text($raw))), fn ($t) => $t !== ''))];
            case 'url':
                return [true, Json::objectFrom(['url' => self::text($raw)])];
            case 'measurement':
                $value = self::number($part('value'));
                if ($value === null) {
                    return [false, null];
                }
                $category = Units::categoryOf($f);
                $unit = $part('unit');
                $o = ['unit' => $unit, 'baseUnit' => $category['baseUnit'], 'value' => $value];
                $base = Units::toBase($value, $unit, $category);
                if ($base !== null) {
                    $o['base'] = $base;
                }

                return [true, Json::objectFrom($o)];
            case 'name':
                $parts = array_values(array_filter(['prefix', 'first', 'middle', 'last', 'suffix', 'nicknames'], fn ($p) => is_array($raw) && array_key_exists($p, $raw)));

                return [true, $object($parts)];
            case 'address':
                return [true, $object(['line1', 'line2', 'city', 'state', 'zip'])];
            case 'date_range':
                return [true, $object(['start', 'end'])];
            case 'time_picker':
                return match ($f->timeMode()) {
                    'time_block' => [true, $object(['start', 'end'])],
                    'appointment' => [true, $object(['date', 'time'])],
                    default => [true, self::text($raw)],
                };
            case 'multi_populator':
                $rows = [];
                foreach (array_values(is_array($raw) ? $raw : []) as $row => $boxes) {
                    $record = [];
                    foreach (FormView::valueFields($f->children ?? []) as $child) {
                        [$present, $value] = $this->read($child, is_array($boxes) ? $boxes : [], new FieldPath($child->id, $path->entry($row)), $adds, $notices);
                        if ($present) {
                            $record[$child->id] = $value;
                        }
                    }
                    $rows[] = Json::objectFrom($record);
                }

                return [true, $rows];
            default:
                return [true, self::text($raw)];
        }
    }

    // ── Values → boxes ──────────────────────────────────────────────────────

    /**
     * The boxes for these fields, from the controller's values; file fields'
     * lists go to `$attached` instead.
     *
     * @param  list<Field>  $fields
     * @param  array<string, mixed>  $values  The values in this scope.
     */
    private function write(array $fields, array $values, array $entries, FormController $c): array
    {
        $out = [];
        foreach ($fields as $f) {
            $v = $values[$f->id] ?? null;
            $path = new FieldPath($f->id, $entries);
            $parts = fn (array $names) => array_combine($names, array_map(fn ($p) => FormView::part($v, $p), $names));
            switch ($f->type) {
                case 'file_upload':
                    foreach (array_filter(Json::list($v) ?? [], fn ($file) => $file instanceof stdClass) as $file) {
                        $this->attached[$path->key()][] = ($file->pending ?? null) === true && isset($c->pendingFiles[$file->localId ?? ''])
                            ? ['held' => $file->localId, 'name' => $file->name, 'size' => (int) $file->size, 'mimeType' => $file->mimeType]
                            : ['stored' => Json::encode($file)];
                    }
                    break;
                case 'checkbox':
                    $out[$f->id] = array_map(FormView::str(...), Json::list($v) ?? []);
                    break;
                case 'boolean':
                    $out[$f->id] = $v === true;
                    break;
                case 'slider':
                    $out[$f->id] = FormView::number(FormView::slider($f, $v)['current']);
                    break;
                case 'choice_cards':
                case 'collection_select':
                    $out[$f->id] = $f->isMulti() ? array_map(FormView::str(...), Json::list($v) ?? []) : FormView::str($v);
                    break;
                case 'tags':
                    $out[$f->id] = implode(', ', array_map(FormView::str(...), Json::list($v) ?? []));
                    break;
                case 'url':
                    $out[$f->id] = FormView::part($v, 'url');
                    break;
                case 'measurement':
                    $out[$f->id] = ['value' => FormView::part($v, 'value'), 'unit' => FormView::measurement($f, $v)['unit']];
                    break;
                case 'name':
                    $out[$f->id] = $parts(['prefix', 'first', 'middle', 'last', 'suffix', 'nicknames']);
                    break;
                case 'address':
                    $out[$f->id] = $parts(['line1', 'line2', 'city', 'state', 'zip']);
                    break;
                case 'date_range':
                    $out[$f->id] = $parts(['start', 'end']);
                    break;
                case 'time_picker':
                    $out[$f->id] = match ($f->timeMode()) {
                        'time_block' => $parts(['start', 'end']),
                        'appointment' => $parts(['date', 'time']),
                        default => FormView::str($v),
                    };
                    break;
                case 'multi_populator':
                    $rows = [];
                    $count = FormView::repeater($f, $v)['count'];
                    $list = Json::list($v) ?? [];
                    for ($row = 0; $row < $count; $row++) {
                        $record = ($list[$row] ?? null) instanceof stdClass ? get_object_vars($list[$row]) : [];
                        $rows[] = $this->write(FormView::valueFields($f->children ?? []), $record, $path->entry($row), $c);
                    }
                    $out[$f->id] = $rows;
                    break;
                default:
                    $out[$f->id] = FormView::str($v);
            }
        }

        return $out;
    }

    public function render(): View
    {
        if ($this->view === null) {
            $this->run('change');
        }

        return view('livewire.bd-form', ['v' => $this->view]);
    }
}
