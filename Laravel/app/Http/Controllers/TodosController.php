<?php

namespace App\Http\Controllers;

use App\Bd\Bd;
use App\Bd\Client;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * The relational custom-database demo.
 *
 * `bd.data-model.config.ts` declares two objects: `todos`, and `todoImages`
 * whose `todo` field is a RELATION back to todos. Push them with
 * `npm run sync-data-model`, promote in the dashboard, then set the generated
 * "Todo Form" Live.
 *
 * Read path: `dataModel()->listRecords()` — relations come back as links and
 * are joined here, server-side.
 * Write path: `forms()->submit()` against the generated form. That is the
 * documented create path; there is deliberately no direct row-insert API, so
 * validation stays on the platform.
 *
 * Reads need `metadata:read_records` on the key.
 */
class TodosController extends Controller
{
    private const TODO_FORM_SLUG = 'todo-form';

    public function index(): View
    {
        $todos = Bd::attempt(
            static fn (Client $c) => $c->dataModel()->listAllRecords('todos'),
            default: [],
        );

        $images = Bd::attempt(
            static fn (Client $c) => $c->dataModel()->listAllRecords('todoImages'),
            default: [],
        );

        // Join images onto their todo. The relation arrives as a link value,
        // so group by whichever id shape the record carries.
        $imagesByTodo = [];
        foreach ($images as $image) {
            $todoRef = $image['fields']['todo'] ?? null;
            $todoId = is_array($todoRef) ? ($todoRef['id'] ?? null) : $todoRef;
            if (is_string($todoId)) {
                $imagesByTodo[$todoId][] = $image;
            }
        }

        return view('pages.todos', [
            'todos' => $todos,
            'imagesByTodo' => $imagesByTodo,
            'configured' => Bd::configured(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $result = Bd::attempt(static fn (Client $c) => $c->forms()->submit(
            self::TODO_FORM_SLUG,
            array_filter([
                'title' => $validated['title'],
                'notes' => $validated['notes'] ?? null,
                'done' => false,
            ], static fn ($v) => $v !== null),
            source: 'laravel-starter',
        ));

        if ($result) {
            Bd::forget(['bd:data-model']);
        }

        return back()->with(
            'todo_status',
            $result ? 'Added.' : 'Could not add that todo — is the Todo Form set Live?'
        );
    }
}
