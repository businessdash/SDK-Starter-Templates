<?php

namespace App\Http\Controllers;

use App\Bd\Bd;
use App\Bd\Client;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * Home, updates feed, newsletter.
 *
 * Every read goes through `Bd::remember()` with a local fallback, so this
 * renders a complete page with no BD credentials at all.
 */
class HomeController extends Controller
{
    public function index(): View
    {
        $bundle = Bd::remember(
            'marketing:home',
            ['bd:marketing'],
            static fn (Client $c) => $c->marketing()->getPageBundle('home'),
            default: [],
        );

        $products = Bd::remember(
            'storefront:featured',
            ['bd:storefront'],
            static fn (Client $c) => $c->storefront()->listProducts(limit: 6),
            default: ['items' => []],
        );

        $posts = Bd::remember(
            'blog:recent',
            ['bd:blog'],
            static fn (Client $c) => $c->blog()->listPosts(limit: 3),
            default: ['items' => []],
        );

        return view('pages.home', [
            'bundle' => $bundle,
            'products' => $products['items'] ?? [],
            'posts' => $posts['items'] ?? [],
        ]);
    }

    public function updates(): View
    {
        $bundle = Bd::remember(
            'marketing:home',
            ['bd:marketing'],
            static fn (Client $c) => $c->marketing()->getPageBundle('home'),
            default: [],
        );

        return view('pages.updates', [
            'updates' => $bundle['updates'] ?? [],
        ]);
    }

    /**
     * Newsletter join. Rides the server-side key rather than a publishable
     * token — this app renders entirely server-side, so there is no browser
     * client to hold one.
     */
    public function subscribe(Request $request)
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'name' => ['nullable', 'string', 'max:200'],
        ]);

        $result = Bd::attempt(
            static fn (Client $c) => $c->followers()->join(
                $validated['email'],
                $validated['name'] ?? null,
                source: 'laravel-starter',
            ),
        );

        return back()->with(
            'subscribe_status',
            $result ? 'Thanks — you are on the list.' : 'Could not subscribe right now.'
        );
    }
}
