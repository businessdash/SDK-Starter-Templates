<?php

namespace Tests\Unit;

use App\Bd\Forms\Backend;
use App\Bd\Forms\FieldPath;
use App\Bd\Forms\FormController;
use App\Bd\Forms\FormsError;
use App\Bd\Forms\Json;
use App\Bd\Forms\PickedFile;
use App\Bd\Forms\Rules;
use App\Bd\Forms\Schema;
use App\Bd\Forms\Submission;
use App\Bd\Forms\SubmitResult;
use PHPUnit\Framework\TestCase;
use stdClass;

/** A backend that records what it was sent and answers from a script. */
final class MockBackend implements Backend
{
    /** @var list<Submission> */
    public array $submissions = [];

    /** @var list<string> */
    public array $uploads = [];

    public bool $failUploads = false;

    /** @var array{int, array<string, mixed>} */
    public array $answer = [201, ['submissionId' => 'sub_1']];

    public function __construct(private readonly array $fields, private readonly array $settings = []) {}

    public function schema(string $form): Schema
    {
        return Schema::fromJson(Json::normalize([
            'id' => 'form_1', 'slug' => 'contact', 'name' => 'Contact',
            'fields' => $this->fields, 'settings' => Json::objectFrom($this->settings),
        ]));
    }

    public function submit(string $form, Submission $submission): SubmitResult
    {
        $this->submissions[] = $submission;
        [$status, $body] = $this->answer;
        if ($status >= 200 && $status < 300) {
            return SubmitResult::success($status, $body['submissionId'] ?? null);
        }

        return SubmitResult::fromResponse($status, Json::normalize($body));
    }

    public function upload(string $form, string $fieldId, PickedFile $file): stdClass
    {
        if ($this->failUploads) {
            throw new FormsError('Upload failed.', 500);
        }
        $this->uploads[] = $file->name;

        return Json::objectFrom([
            'storageId' => "s/{$file->name}", 'url' => "https://cdn.example.com/{$file->name}",
            'name' => $file->name, 'mimeType' => $file->mimeType, 'size' => (float) $file->size,
        ]);
    }

    public function collectionOptions(string $form, string $fieldId): array
    {
        return [
            ['value' => 'r1', 'label' => 'Gold', 'image' => null, 'match' => ['tier' => 'premium']],
            ['value' => 'r2', 'label' => 'Basic', 'image' => null, 'match' => ['tier' => 'standard']],
        ];
    }

    public function lastData(): stdClass
    {
        return end($this->submissions)?->data ?? new stdClass;
    }
}

final class FormControllerTest extends TestCase
{
    private static function controller(MockBackend $b): FormController
    {
        return new FormController($b->schema('contact'), $b);
    }

    private static function file(string $name, string $type, int $size = 10): PickedFile
    {
        return new PickedFile($name, $type, $size, fn () => str_repeat('x', $size));
    }

    private static function set(FormController $c, string $id, mixed $value): void
    {
        $c->setValue(Json::normalize($value), new FieldPath($id));
    }

    public function test_loads_and_submits_with_output_keys(): void
    {
        $b = new MockBackend([
            ['id' => 'f1', 'type' => 'text', 'label' => 'Your name', 'required' => true, 'key' => 'full_name'],
            ['id' => 'f2', 'type' => 'email', 'label' => 'Email', 'required' => true],
            ['id' => 't', 'type' => 'title', 'label' => 'Hello'],
        ]);
        $c = self::controller($b);
        self::set($c, 'f1', 'Ada');
        self::set($c, 'f2', 'ada@example.com');
        $r = $c->submit();
        $this->assertTrue($r->ok);
        $this->assertTrue($c->isSubmitted());
        $this->assertSame('Ada', $b->lastData()->full_name);
        $this->assertSame('ada@example.com', $b->lastData()->f2);
        $this->assertFalse(property_exists($b->lastData(), 't'));
        $this->assertSame('laravel-starter', $b->submissions[0]->source);
    }

    public function test_required_and_format_errors_block_submit(): void
    {
        $b = new MockBackend([
            ['id' => 'name', 'type' => 'text', 'label' => 'Name', 'required' => true],
            ['id' => 'email', 'type' => 'email', 'label' => 'Email'],
        ]);
        $c = self::controller($b);
        self::set($c, 'email', 'not-an-email');
        $r = $c->submit();
        $this->assertFalse($r->ok);
        $this->assertSame('client_validation_failed', $r->reason);
        $this->assertSame('Name is required.', $c->errors['name']);
        $this->assertSame('Enter a valid email address.', $c->errors['email']);
        $this->assertSame([], $b->submissions);
    }

    public function test_blur_shows_format_but_not_required_until_attempted(): void
    {
        $c = self::controller(new MockBackend([['id' => 'email', 'type' => 'email', 'label' => 'Email', 'required' => true]]));
        $c->validate(new FieldPath('email'));
        $this->assertArrayNotHasKey('email', $c->errors, 'an untouched required field stays quiet on blur');
        self::set($c, 'email', 'bad');
        $c->validate(new FieldPath('email'));
        $this->assertSame('Enter a valid email address.', $c->errors['email']);
        self::set($c, 'email', 'good@example.com');
        $this->assertArrayNotHasKey('email', $c->errors, 'fixing the value clears the error');
    }

    public function test_business_email_rule(): void
    {
        $c = self::controller(new MockBackend([
            ['id' => 'email', 'type' => 'email', 'label' => 'Work email', 'emailConfig' => ['businessOnly' => true]],
        ]));
        self::set($c, 'email', 'someone@gmail.com');
        $c->validate(new FieldPath('email'));
        $this->assertSame('Please use your work email address.', $c->errors['email']);
    }

    public function test_stepped_form_validates_each_step_and_follows_conditions(): void
    {
        $b = new MockBackend([
            ['id' => 'kind', 'type' => 'radio', 'label' => 'Kind', 'required' => true, 'options' => ['Home', 'Business']],
            ['id' => 'biz', 'type' => 'condition_block', 'label' => '',
                'conditionRule' => ['fieldId' => 'kind', 'operator' => 'eq', 'value' => 'Business'],
                'children' => [['id' => 'company', 'type' => 'text', 'label' => 'Company', 'required' => true]]],
            ['id' => 'notes', 'type' => 'textarea', 'label' => 'Notes'],
        ], ['isConsecutive' => true]);
        $c = self::controller($b);
        $this->assertSame(2, $c->stepCount(), 'the business page is hidden until chosen');
        $this->assertFalse($c->next());
        $this->assertSame('Kind is required.', $c->errors['kind']);
        self::set($c, 'kind', 'Business');
        $this->assertSame(3, $c->stepCount());
        $this->assertTrue($c->next());
        $this->assertSame(1, $c->currentStep());
        $this->assertFalse($c->next());
        $this->assertSame('Company is required.', $c->errors['company']);
        $c->back();
        $this->assertSame([], $c->errors);
        self::set($c, 'kind', 'Home');
        $this->assertSame(2, $c->stepCount());
        $this->assertTrue($c->submit()->ok, "a hidden required field doesn't block");
    }

    public function test_repeater_errors_land_on_the_entry_field(): void
    {
        $b = new MockBackend([
            ['id' => 'kids', 'type' => 'multi_populator', 'label' => 'Children', 'populatorConfig' => ['maxInstances' => 3],
                'children' => [
                    ['id' => 'kname', 'type' => 'text', 'label' => 'Name', 'required' => true],
                    ['id' => 'kage', 'type' => 'number', 'label' => 'Age', 'validation' => ['min' => 0, 'max' => 17]],
                ]],
        ]);
        $c = self::controller($b);
        $kids = new FieldPath('kids');
        $c->setValue('Sam', new FieldPath('kname', $kids->entry(0)));
        $c->addEntry($kids);
        $c->setValue(30.0, new FieldPath('kage', $kids->entry(1)));
        $c->submit();
        $this->assertSame('Name is required.', $c->errors['kids[1].kname']);
        $this->assertSame('Enter 17 or less.', $c->errors['kids[1].kage']);
        $c->removeEntry(1, $kids);
        $this->assertCount(1, $c->entries($kids));
        $this->assertTrue($c->submit()->ok);
        $this->assertSame('[{"kname":"Sam"}]', Json::encode($b->lastData()->kids));
    }

    public function test_calculations_recompute_on_edit(): void
    {
        $c = self::controller(new MockBackend([
            ['id' => 'qty', 'type' => 'number', 'label' => 'Qty'],
            ['id' => 'price', 'type' => 'currency', 'label' => 'Price'],
            ['id' => 'total', 'type' => 'calculation', 'label' => 'Total',
                'calculationConfig' => ['formula' => 'q * p', 'inputMap' => [['variable' => 'q', 'fieldId' => 'qty'], ['variable' => 'p', 'fieldId' => 'price']]]],
        ]));
        self::set($c, 'qty', 3);
        self::set($c, 'price', 2.5);
        $this->assertSame(7.5, $c->values['total']);
        self::set($c, 'qty', null);
        $this->assertNull($c->values['total'], 'a missing input leaves the result empty');
    }

    public function test_files_upload_on_submit_and_swap_placeholders(): void
    {
        $b = new MockBackend([
            ['id' => 'docs', 'type' => 'file_upload', 'label' => 'Docs', 'fileConfig' => ['maxFiles' => 2, 'allowedTypes' => ['application/pdf']]],
        ]);
        $c = self::controller($b);
        $taken = $c->addFiles(['p1' => self::file('a.pdf', 'application/pdf'), 'p2' => self::file('b.png', 'image/png')], new FieldPath('docs'));
        $this->assertSame(['p1'], $taken);
        $this->assertCount(1, $c->values['docs'], "the png isn't an allowed type");
        $this->assertSame('File type not allowed: image/png', $c->errors['docs']);
        $this->assertTrue($c->submit()->ok);
        $this->assertSame(['a.pdf'], $b->uploads);
        $this->assertSame('https://cdn.example.com/a.pdf', $b->lastData()->docs[0]->url);
    }

    public function test_failed_upload_keeps_the_form_open(): void
    {
        $b = new MockBackend([['id' => 'docs', 'type' => 'file_upload', 'label' => 'Docs']]);
        $b->failUploads = true;
        $c = self::controller($b);
        $c->addFiles(['x' => self::file('x.txt', 'text/plain', 1)], new FieldPath('docs'));
        $r = $c->submit();
        $this->assertFalse($r->ok);
        $this->assertSame('network_error', $r->reason);
        $this->assertSame('Upload failed.', $c->errors['docs']);
        $this->assertSame([], $b->submissions);
        $this->assertTrue(Rules::isPendingUpload($c->values['docs'][0]), 'the file is still there to retry');
    }

    public function test_server_issues_map_back_to_fields(): void
    {
        $b = new MockBackend([['id' => 'f1', 'type' => 'text', 'label' => 'Code', 'key' => 'promo']]);
        $b->answer = [422, ['error' => 'validation_failed', 'message' => 'Bad', 'issues' => [['id' => 'promo', 'label' => 'Code', 'reason' => 'regex']]]];
        $c = self::controller($b);
        self::set($c, 'f1', 'x');
        $r = $c->submit();
        $this->assertSame('validation_failed', $r->reason);
        $this->assertSame("Code isn't in the expected format.", $c->errors['f1']);
    }

    public function test_status_codes_map_like_the_js_sdk(): void
    {
        $reason = fn (int $status, array $body = []) => SubmitResult::fromResponse($status, Json::objectFrom($body))->reason;
        $this->assertSame('unauthorized', $reason(401));
        $this->assertSame('forbidden', $reason(403));
        $this->assertSame('plan_required', $reason(402));
        $this->assertSame('payment_required', $reason(402, ['reason' => 'payment_required']));
        $this->assertSame('service_suspended', $reason(402, ['reason' => 'service_suspended']));
        $this->assertSame('rate_limited', $reason(429));
        $this->assertSame('not_found', $reason(404));
        $this->assertSame('invalid_request', $reason(400));
        $this->assertSame('validation_failed', $reason(400, ['error' => 'validation_failed']));
        $this->assertSame('server_error', $reason(500));
    }

    public function test_collection_match_conditions(): void
    {
        $c = self::controller(new MockBackend([
            ['id' => 'plan', 'type' => 'collection_select', 'label' => 'Plan'],
            ['id' => 'vip', 'type' => 'condition_block', 'label' => '',
                'conditionRule' => ['fieldId' => 'plan', 'operator' => 'eq', 'value' => 'premium', 'matchField' => 'tier'],
                'children' => [['id' => 'concierge', 'type' => 'text', 'label' => 'Concierge', 'required' => true]]],
        ]));
        self::set($c, 'plan', 'r2');
        $this->assertFalse($c->isVisible($c->field('vip')));
        self::set($c, 'plan', 'r1');
        $this->assertTrue($c->isVisible($c->field('vip')));
        $this->assertFalse($c->submit()->ok);
        $this->assertArrayHasKey('concierge', $c->errors);
    }

    public function test_date_range_order(): void
    {
        $c = self::controller(new MockBackend([['id' => 'trip', 'type' => 'date_range', 'label' => 'Trip']]));
        self::set($c, 'trip', ['start' => '2026-12-10', 'end' => '2026-12-01']);
        $c->validate(new FieldPath('trip'));
        $this->assertSame('The end must come after the start.', $c->errors['trip']);
    }

    public function test_custom_messages(): void
    {
        $c = self::controller(new MockBackend([['id' => 'n', 'type' => 'text', 'label' => 'Nom', 'required' => true]]));
        $c->messages = fn (string $reason, string $label) => $reason === 'required' ? "{$label} est obligatoire." : $reason;
        $c->submit();
        $this->assertSame('Nom est obligatoire.', $c->errors['n']);
    }

    public function test_seed_applies_defaults(): void
    {
        $c = self::controller(new MockBackend([['id' => 'n', 'type' => 'text', 'label' => 'N', 'defaultValue' => 'hi']]));
        $this->assertSame('hi', $c->values['n']);
    }
}
