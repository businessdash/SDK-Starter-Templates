<?php

namespace App\Livewire;

use App\Bd\Forms\Field;
use App\Bd\Forms\FormsError;
use App\Bd\Forms\Js;
use App\Bd\Forms\Json;
use App\Bd\Forms\QuizBackend;
use App\Bd\Forms\QuizController;
use App\Bd\Forms\QuizOptions;
use App\Bd\Forms\QuizPage;
use App\Bd\Forms\QuizScoring;
use App\Bd\Forms\QuizState;
use App\Bd\Forms\QuizWords;
use App\Bd\Forms\Quizzes;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Str;
use Illuminate\View\View;
use Livewire\Attributes\Locked;
use Livewire\Component;
use stdClass;
use Throwable;

/**
 * A BusinessDash quiz, drawn on this server: `<livewire:bd-quiz source="…" />`.
 *
 * The quiz BD's hosted /quiz-invite page shows (one question at a time with
 * lettered choices, "I don't know" when the quiz offers it, the verdict and
 * why after each answer or all at the end, a timer, the results), run by the
 * same engine as every BD starter (App\Bd\Forms\QuizEngine, a port of
 * forms-core's quiz). This component draws its screen with the SDK's
 * `bd-quiz__*` classes; the grading, the clock and the wording are the engine's.
 *
 *     sample        the bundled sample: graded here, never sent anywhere
 *     practice      a practice quiz from BD ("Practice on your site"): BD grades, this server times
 *     invitation    an invitation: BD starts the clock, keeps the answers, grades and records
 *
 * A run is kept in the cache between requests (3 hours). A practice run or
 * the sample picks up where this browser left off (the `bd_quiz_run`
 * cookie); an invitation is read from BD on each page load, since BD keeps
 * its answers and its clock. A running clock is re-read once a second while
 * the page is open, and a timed quiz submits at zero. PHP has no clock of its
 * own between requests, so if the page is closed a practice run simply ends
 * unsent, and an invitation's deadline is BD's to enforce.
 */
class BdQuiz extends Component
{
    public const SAMPLE = 'sample';

    public const RUN_COOKIE = 'bd_quiz_run';

    private const RUN_SECONDS = 3 * 60 * 60;

    /** "I don't know" on a single-answer question: a choice in the same group. */
    public const DONT_KNOW = '~dont-know';

    /** 'sample', 'practice' or 'invitation'. */
    #[Locked]
    public string $source = self::SAMPLE;

    /** The practice quiz's slug, or the invitation's token. */
    #[Locked]
    public string $ref = '';

    #[Locked]
    public ?string $run = null;

    /** The page around the quiz: header and gate (QuizPage). */
    #[Locked]
    public array $page = ['header' => null, 'gate' => null];

    /** Why the quiz isn't showing, with a Try again link. */
    #[Locked]
    public ?string $status = null;

    /** Each question's answer as the page shows it. */
    public array $answers = [];

    /** "I don't know" on a multiple-answer question. */
    public array $dk = [];

    private ?QuizController $controller = null;

    private bool $applied = false;

    public function mount(string $source = self::SAMPLE, string $ref = ''): void
    {
        $this->source = in_array($source, ['sample', 'practice', 'invitation'], true) ? $source : self::SAMPLE;
        $this->ref = $ref;
        $remembered = $this->source === 'invitation' ? null : request()->cookie(self::RUN_COOKIE);
        $record = is_string($remembered) ? self::find($remembered) : null;
        if ($record !== null && $record['source'] === $this->source && $record['ref'] === $this->ref) {
            $this->run = $remembered;
            $this->page = $record['page'];

            return;
        }
        $this->start();
    }

    /** Where this quiz's page is: Try again, and Sign in coming back here. */
    public function path(): string
    {
        return match ($this->source) {
            'practice' => '/quiz/'.rawurlencode($this->ref),
            'invitation' => '/quiz-invite/'.rawurlencode($this->ref),
            default => '/quiz/'.self::SAMPLE,
        };
    }

    // ── Loading ─────────────────────────────────────────────────────────────

    private function signInHref(): string
    {
        return '/my-account?next='.rawurlencode($this->path());
    }

    /** Read the quiz from BD (or the sample) and start a run, unless a gate is all there is. */
    private function start(): void
    {
        $words = new QuizWords;
        $quizzes = $this->source === 'sample' ? null : Quizzes::fromConfig(self::session());
        if ($this->source !== 'sample' && $quizzes === null) {
            $this->page = ['header' => null, 'gate' => ['kind' => 'invalid', 'title' => null, 'body' => $words->invalid, 'action' => null]];

            return;
        }
        try {
            $data = match ($this->source) {
                'practice' => $quizzes->practice($this->ref),
                'invitation' => $quizzes->invitation($this->ref),
                default => self::sampleData(),
            };
        } catch (FormsError $e) {
            if ($e->status === 404) {
                $this->page = $this->source === 'invitation'
                    ? QuizPage::invitation(null, $words)
                    : ['header' => null, 'gate' => ['kind' => 'invalid', 'title' => null, 'body' => $words->invalid, 'action' => null]];

                return;
            }
            report($e);
            $this->status = "We couldn't load this quiz.";

            return;
        } catch (Throwable $e) {
            report($e);
            $this->status = "We couldn't load this quiz.";

            return;
        }

        $this->page = match ($this->source) {
            'invitation' => QuizPage::invitation($data, $words, $this->signInHref(), '/api/bd-auth/sign-out'),
            default => QuizPage::practice($data, $words),
        };
        if ($this->page['gate'] !== null) {
            return;
        }
        [$options, $initial] = $this->options($data);
        $controller = new QuizController($options, $this->backend(), $initial);
        $this->run = (string) Str::uuid();
        $this->controller = $controller;
        $this->save(['source' => $this->source, 'ref' => $this->ref, 'page' => $this->page, 'data' => Json::encode($data)]);
        if ($this->source !== 'invitation') {
            // Brings a reload back to the same run.
            Cookie::queue(Cookie::make(self::RUN_COOKIE, $this->run, self::RUN_SECONDS / 60, '/', null, null, true, false, 'lax'));
        }
    }

    /** The sample: answer keys and all, graded on this server. */
    private static function sampleData(): stdClass
    {
        $file = Json::decode((string) file_get_contents(resource_path('forms/demo-quiz.json')));

        return Json::objectFrom([
            'name' => 'Sample quiz',
            'description' => 'Bundled with the starter and graded on this server. Set BD_QUIZ and your BD keys to take one of your practice quizzes.',
            'estimatedMinutes' => 2.0,
            'timeLimitMinutes' => 5.0,
            'fields' => $file->fields ?? [],
        ]);
    }

    /** @return array{QuizOptions, array} The run's options and where it starts. */
    private function options(stdClass $data): array
    {
        return match ($this->source) {
            'practice' => [QuizOptions::fromPractice($data), []],
            'invitation' => [QuizOptions::fromInvitation($data, $this->signInHref()), self::initial($data)],
            default => [new QuizOptions(Field::list($data->fields ?? null), feedbackMode: 'immediate', timeLimitMinutes: 5.0, allowDontKnow: true), []],
        };
    }

    /** What BD kept of an invitation: locked answers and verdicts, the clock, a finished attempt. */
    private static function initial(stdClass $invitation): array
    {
        $initial = [
            'answers' => Json::toMap($invitation->lockedAnswers ?? null),
            'results' => array_map(QuizScoring::readResult(...), Json::list($invitation->lockedResults ?? null) ?? []),
            'startedAt' => Json::str($invitation->startedAt ?? null),
            'deadlineAt' => Json::str($invitation->deadlineAt ?? null),
        ];
        if (($invitation->attempt ?? null) instanceof stdClass) {
            $initial['completion'] = QuizScoring::readCompletion($invitation->attempt);
        }
        if (($now = Json::num($invitation->serverNow ?? null)) !== null) {
            $initial['serverNow'] = $now;
        }

        return $initial;
    }

    private function backend(): ?QuizBackend
    {
        $quizzes = $this->source === 'sample' ? null : Quizzes::fromConfig(self::session());

        return match ($this->source) {
            'practice' => $quizzes?->practiceBackend($this->ref),
            'invitation' => $quizzes?->invitationBackend($this->ref),
            default => null,
        };
    }

    /** The visitor's BD session, for an invitation that needs the invited account. */
    private static function session(): ?string
    {
        $token = request()->cookie(config('bd.session_cookie'));

        return is_string($token) && $token !== '' ? $token : null;
    }

    // ── Runs ────────────────────────────────────────────────────────────────

    private static function key(string $run): string
    {
        return 'bd.quiz.run.'.$run;
    }

    private static function find(string $run): ?array
    {
        $record = Str::isUuid($run) ? Cache::get(self::key($run)) : null;

        return is_array($record) ? $record : null;
    }

    private function save(array $record): void
    {
        $c = $this->controller;
        $record['seed'] = $c->seed;
        $record['state'] = Json::encode($c->state->toJson());
        $record['lastDraft'] = Json::encode(Json::objectFrom($c->lastDraft));
        Cache::put(self::key($this->run), $record, self::RUN_SECONDS);
    }

    /** This request's controller: the run, rebuilt from the cache. Null: the run is gone. */
    private function controller(): ?QuizController
    {
        if ($this->controller !== null || $this->run === null) {
            return $this->controller;
        }
        $record = self::find($this->run);
        if ($record === null) {
            return null;
        }
        try {
            $data = Json::decode($record['data']);
            [$options] = $this->options($data);
            $this->controller = new QuizController(
                $options, $this->backend(),
                seed: $record['seed'],
                state: QuizState::fromJson(Json::decode($record['state'])),
                lastDraft: Json::toMap(Json::decode($record['lastDraft'])),
            );
        } catch (Throwable $e) {
            report($e);

            return null;
        }

        return $this->controller;
    }

    // ── What the page asks for ──────────────────────────────────────────────

    /** A button: one of the screen's actions, or 'primary' (Enter in a box). */
    public function act(string $action): void
    {
        $c = $this->begin();
        if ($c === null) {
            return;
        }
        $actions = array_filter($c->screen()['actions'], fn ($a) => $a['enabled'] && $a['href'] === null);
        foreach ($actions as $a) {
            if ($action === 'primary' ? $a['primary'] : $a['id'] === $action) {
                $c->perform($a['id']);
                break;
            }
        }
    }

    /** The clock, re-read once a second while it runs: at zero the quiz submits. */
    public function tick(): void
    {
        $c = $this->begin();
        if ($c === null) {
            return;
        }
        $c->tick();
    }

    /** The run for this request, with the page's answers applied; a lost run starts again. */
    private function begin(): ?QuizController
    {
        $c = $this->controller();
        if ($c === null) {
            if ($this->run !== null) {
                $this->run = null;
                $this->reset('answers', 'dk');
                $this->start();
            }

            return $this->controller;
        }
        if (! $this->applied) {
            $this->applied = true;
            $this->applyAnswers($c);
        }

        return $c;
    }

    /** Each answer the page showed (and didn't lock) → the controller, when it changed. */
    private function applyAnswers(QuizController $c): void
    {
        foreach ($c->screen()['questions'] as $q) {
            if ($q['locked']) {
                continue;
            }
            $id = $q['field']->id;
            if (! array_key_exists($id, $this->answers)) {
                continue;
            }
            $raw = $this->answers[$id];
            $wasDontKnow = in_array($id, $c->state->dontKnow, true);
            $current = $c->state->answers[$id] ?? null;
            if ($q['choices'] !== null && $q['multiple']) {
                $picked = array_values(array_map('strval', array_filter(is_array($raw) ? $raw : [], 'is_scalar')));
                $dontKnow = ($this->dk[$id] ?? false) === true;
                $before = array_map(fn ($v) => Js::string($v), Json::list($current) ?? []);
                if ($dontKnow && ! $wasDontKnow) {
                    $c->chooseDontKnow($id);
                } elseif ($wasDontKnow && ($picked !== [] || ! $dontKnow)) {
                    $c->setAnswer($id, $picked);
                } elseif (! $wasDontKnow && self::sorted($picked) !== self::sorted($before)) {
                    $c->setAnswer($id, $picked);
                }
            } elseif ($q['choices'] !== null) {
                $picked = is_string($raw) ? $raw : '';
                if ($picked === self::DONT_KNOW) {
                    if (! $wasDontKnow) {
                        $c->chooseDontKnow($id);
                    }
                } elseif ($picked !== '' && ($wasDontKnow || $picked !== $current)) {
                    $c->setAnswer($id, $picked);
                }
            } else {
                $typed = is_string($raw) ? $raw : '';
                if ($typed !== ($current === null ? '' : Js::string($current))) {
                    $c->setAnswer($id, $typed);
                }
            }
        }
    }

    private static function sorted(array $list): array
    {
        sort($list, SORT_STRING);

        return array_values(array_unique($list));
    }

    /** The page's answers, from the run. */
    private function syncAnswers(array $screen, QuizController $c): void
    {
        $answers = [];
        $dk = [];
        foreach ($screen['questions'] as $q) {
            $id = $q['field']->id;
            $dontKnow = in_array($id, $c->state->dontKnow, true);
            $value = $c->state->answers[$id] ?? null;
            if ($q['choices'] !== null && $q['multiple']) {
                $answers[$id] = array_map(fn ($v) => Js::string($v), Json::list($value) ?? []);
                $dk[$id] = $dontKnow;
            } elseif ($q['choices'] !== null) {
                $answers[$id] = $dontKnow ? self::DONT_KNOW : (is_string($value) ? $value : '');
            } else {
                $answers[$id] = $value === null ? '' : Js::string($value);
            }
        }
        $this->answers = $answers;
        $this->dk = $dk;
    }

    public function render(): View
    {
        $c = $this->run !== null ? $this->begin() : null;
        $screen = null;
        if ($c !== null) {
            // Keep the run as this request left it (answers, verdicts, the clock).
            if (($record = self::find($this->run)) !== null) {
                $this->save($record);
            }
            $screen = $c->screen();
            $this->syncAnswers($screen, $c);
        }

        return view('livewire.bd-quiz', [
            'screen' => $screen,
            'header' => $this->page['header'] ?? null,
            'gate' => $this->page['gate'] ?? null,
            'polling' => $c !== null && $screen['timer'] !== null && (! $c->state->timeUp || $c->state->pending !== null)
                && $screen['phase'] !== 'done',
            'dontKnowValue' => self::DONT_KNOW,
        ]);
    }
}
