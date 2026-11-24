<?php

namespace App\Http\Controllers;

use App\Bd\Forms\Forms;
use App\Livewire\BdQuiz;
use Illuminate\Http\Response;
use Illuminate\View\View;
use Throwable;

/**
 * Forms and quizzes, drawn on this server (App\Livewire\BdForm and BdQuiz):
 *
 *     /forms/{slug}         any form from the dashboard (the home page's contact section is one)
 *     /forms/demo           the bundled sample form, checked here and never sent
 *     /quiz                 BD_QUIZ (a practice quiz), or the bundled sample
 *     /quiz/{slug}          any practice quiz ("Practice on your site" in BD)
 *     /quiz/sample          the sample: graded here, never sent anywhere
 *     /quiz-invite/{token}  an invitation. BD's invite emails link here when the
 *                           quiz's invite domain (in the builder) is this site.
 */
class FormPageController extends Controller
{
    public function form(string $slug): View
    {
        try {
            $title = Forms::schema($slug)->title;
        } catch (Throwable) {
            $title = null;
        }

        return view('pages.form', ['slug' => $slug, 'title' => $title ?: 'Form']);
    }

    public function quiz(?string $slug = null): Response
    {
        $slug ??= Forms::quizSlug();

        return $slug === BdQuiz::SAMPLE
            ? $this->page(BdQuiz::SAMPLE, '')
            : $this->page('practice', $slug);
    }

    public function invitation(string $token): Response
    {
        return $this->page('invitation', $token);
    }

    private function page(string $source, string $ref): Response
    {
        // A run's answers and clock: never from a cache.
        return response()->view('pages.quiz', ['source' => $source, 'ref' => $ref])
            ->header('Cache-Control', 'no-store');
    }
}
