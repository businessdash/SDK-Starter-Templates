<?php

namespace App\Http\Controllers;

use App\Bd\Bd;
use App\Bd\Client;
use Illuminate\View\View;

class BlogController extends Controller
{
    public function index(): View
    {
        $posts = Bd::remember(
            'blog:list',
            ['bd:blog'],
            static fn (Client $c) => $c->blog()->listPosts(limit: 20),
            default: ['items' => []],
        );

        return view('pages.blog', ['posts' => $posts['items'] ?? []]);
    }

    public function show(string $slug): View
    {
        $post = Bd::remember(
            "blog:post:{$slug}",
            ['bd:blog', "bd:blog:{$slug}"],
            static fn (Client $c) => $c->blog()->getPost($slug),
            default: null,
        );

        abort_if($post === null, 404);

        $comments = Bd::remember(
            "blog:comments:{$slug}",
            ['bd:blog', "bd:blog:{$slug}"],
            static fn (Client $c) => $c->blog()->listComments($slug, limit: 50),
            default: ['items' => []],
        );

        // The API wraps the post: `{ post, access }` — `access` is
        // "granted" or "paywall", which is how a paywalled post is signalled.
        return view('pages.blog-post', [
            'post' => $post['post'] ?? [],
            'access' => $post['access'] ?? 'granted',
            'comments' => $comments['items'] ?? [],
        ]);
    }
}
