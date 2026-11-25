<?php

namespace App\Http\Controllers;

use App\Bd\Auth;
use App\Bd\Bd;
use App\Bd\Client;
use App\Support\PostHtml;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\View\View;

/**
 * The blog: the post list with its category and tag filters, one post, and
 * the like and comment endpoints for signed-in customers.
 *
 * A post's HTML is rebuilt from an allowlist (App\Support\PostHtml) before
 * it reaches the page. The like button and comments are custom elements
 * (public/shop/blog-elements.js); signed out, they lead to sign-in and back.
 */
class BlogController extends Controller
{
    private const PAGE = 12;

    /**
     * One page of posts, pinned first on the first page. A tag is matched
     * here, over the newest 50 posts, because the API filters by category
     * only.
     */
    public function index(Request $request): View
    {
        $category = is_string($v = $request->query('category')) && $v !== '' ? $v : null;
        $tag = is_string($v = $request->query('tag')) && $v !== '' ? $v : null;
        $cursor = is_numeric($v = $request->query('cursor')) ? (int) $v : null;

        $list = Bd::remember(
            'blog:posts:'.md5(json_encode([$category, $cursor, $tag !== null])),
            ['bd:blog'],
            static fn (Client $c) => $c->blog()->listPosts(limit: $tag ? 50 : self::PAGE, cursor: $cursor, categoryId: $category),
            default: ['items' => [], 'nextCursor' => null],
        );
        $categories = Bd::remember('blog:categories', ['bd:blog'], static fn (Client $c) => $c->blog()->listCategories(), default: ['items' => []]);
        $tags = Bd::remember('blog:tags', ['bd:blog'], static fn (Client $c) => $c->blog()->listTags(), default: ['items' => []]);

        $posts = array_values(array_filter(
            $list['items'] ?? [],
            static fn (array $post) => $tag === null || in_array($tag, $post['tags'] ?? [], true),
        ));
        if ($cursor === null) {
            // Pinned first; usort is stable, so the rest keep their order.
            usort($posts, static fn (array $a, array $b) => (int) ! empty($b['isPinned']) <=> (int) ! empty($a['isPinned']));
        }
        $active = collect($categories['items'] ?? [])->firstWhere('id', $category);

        return view('pages.blog', [
            'configured' => Bd::configured(),
            'posts' => $posts,
            'paged' => $cursor !== null,
            'nextCursor' => $tag === null ? ($list['nextCursor'] ?? null) : null,
            'categories' => $categories['items'] ?? [],
            'tags' => $tags['items'] ?? [],
            'category' => $category,
            'tag' => $tag,
            'active' => $active,
        ]);
    }

    public function show(Request $request, string $slug): Response
    {
        $found = Bd::remember(
            "blog:post:{$slug}",
            ['bd:blog', "bd:blog:{$slug}"],
            static fn (Client $c) => $c->blog()->getPost($slug),
            default: null,
        );
        $post = $found['post'] ?? null;

        $view = ['configured' => Bd::configured(), 'post' => $post];
        if ($post) {
            $token = $this->sessionToken($request);
            $signedIn = $token !== null && Auth::fromConfig()?->session($token) !== null;
            $likes = Bd::attempt(
                static fn (Client $c) => $c->blog()->likeStatus($slug, $signedIn ? $token : null),
                default: null,
            );
            $comments = Bd::attempt(static fn (Client $c) => $c->blog()->listComments($slug, limit: 50), default: ['items' => []]);
            $content = (string) ($post['content'] ?? '');
            $view += [
                'html' => PostHtml::safe($content),
                'minutes' => PostHtml::readingMinutes($content),
                'paywalled' => ($found['access'] ?? 'granted') === 'paywall',
                'likes' => [
                    'likes' => $likes ?? ['liked' => false, 'likesCount' => (int) ($post['likes'] ?? 0)],
                    'signedIn' => $signedIn,
                ],
                'comments' => ['comments' => $comments['items'] ?? [], 'signedIn' => $signedIn],
                'signInHref' => route('portal').'?next='.rawurlencode('/blog/'.rawurlencode($slug)),
            ];
        }

        return response()->view('pages.blog-post', $view, Bd::configured() && ! $post ? 404 : 200);
    }

    /** Like or unlike, for the signed-in customer: `{ liked, likesCount }` or `{ error }`. */
    public function like(Request $request, string $slug): JsonResponse
    {
        if (! Bd::configured()) {
            return $this->json(['error' => "The blog isn't connected yet."], 503);
        }
        if (! $request->isJson()) {
            return $this->json(['error' => 'Send JSON.'], 415);
        }
        $token = $this->sessionToken($request);
        if (! $token) {
            return $this->json(['error' => 'Sign in to like posts.'], 401);
        }
        $result = Bd::attempt(static fn (Client $c) => $c->blog()->toggleLike($slug, $token), default: null);

        return $result === null
            ? $this->json(['error' => "Couldn't save your like. Try again."], 502)
            : $this->json(['liked' => (bool) ($result['liked'] ?? false), 'likesCount' => (int) ($result['likesCount'] ?? 0)]);
    }

    /** `{ content }` in; out, whether it shows now or waits for approval, and the comments as they are now. */
    public function comment(Request $request, string $slug): JsonResponse
    {
        if (! Bd::configured()) {
            return $this->json(['ok' => false, 'error' => "The blog isn't connected yet."], 503);
        }
        if (! $request->isJson()) {
            return $this->json(['ok' => false, 'error' => 'Send JSON.'], 415);
        }
        $token = $this->sessionToken($request);
        if (! $token) {
            return $this->json(['ok' => false, 'error' => 'Sign in to comment.'], 401);
        }
        $content = trim((string) $request->json('content', ''));
        if ($content === '') {
            return $this->json(['ok' => false, 'error' => 'Write something first.'], 400);
        }
        if (mb_strlen($content) > 5000) {
            return $this->json(['ok' => false, 'error' => 'Comments are up to 5,000 characters.'], 400);
        }
        $posted = Bd::attempt(static fn (Client $c) => $c->blog()->postComment($slug, $content, $token), default: null);
        if ($posted === null) {
            return $this->json(['ok' => false, 'error' => "Couldn't post your comment. Try again."], 502);
        }
        $comments = Bd::attempt(static fn (Client $c) => $c->blog()->listComments($slug, limit: 50), default: ['items' => []]);

        return $this->json([
            'ok' => true,
            'approved' => (bool) data_get($posted, 'moderation.isApproved', false),
            'comments' => $comments['items'] ?? [],
        ]);
    }

    private function sessionToken(Request $request): ?string
    {
        $token = $request->cookie(config('bd.session_cookie'));

        return is_string($token) && $token !== '' ? $token : null;
    }

    private function json(array $body, int $status = 200): JsonResponse
    {
        return response()->json($body, $status)->header('Cache-Control', 'no-store');
    }
}
