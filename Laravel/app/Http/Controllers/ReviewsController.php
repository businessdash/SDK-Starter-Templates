<?php

namespace App\Http\Controllers;

use App\Bd\Auth;
use App\Bd\Bd;
use App\Bd\Client;
use App\Support\Reviews;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * The business's reviews: the rating over all of them with a bar per star,
 * a platform filter, each review with its photos and a link to it on Google
 * or Yelp, more on demand, and writing one.
 *
 *   GET  /reviews?source=yelp&shown=20   the page; the filter and "Show more" are links
 *   POST /reviews/write                  JSON from <bd-review-writer> (public/shop/reviews-elements.js)
 *
 * The rules are App\Support\Reviews, the same as every BD starter's.
 */
class ReviewsController extends Controller
{
    /** The most a "Show more" link asks for. */
    private const MOST_SHOWN = 200;

    public function index(Request $request): View
    {
        $source = Reviews::sourceParam($request->query('source'));
        $shown = min(self::MOST_SHOWN, max(Reviews::PAGE_SIZE, (int) $request->query('shown', Reviews::PAGE_SIZE)));
        $shown -= $shown % Reviews::PAGE_SIZE;

        $page = Bd::remember(
            'reviews:'.($source ?? 'all').":{$shown}",
            ['bd:reviews'],
            static fn (Client $c) => self::firstReviews($c, $shown, $source),
            default: ['items' => [], 'totalCount' => 0, 'nextOffset' => null],
        );
        $bundle = Bd::remember(
            'marketing:home',
            ['bd:marketing'],
            static fn (Client $c) => $c->marketing()->getPageBundle('home'),
            default: [],
        );
        // The platforms for the filter, from the newest 50.
        $newest = Bd::remember(
            'reviews:sources',
            ['bd:reviews'],
            static fn (Client $c) => $c->reviews()->list(limit: 50),
            default: ['items' => []],
        );

        $items = $page['items'] ?? [];
        $next = $page['nextOffset'] ?? null;

        return view('pages.reviews', [
            'configured' => Bd::configured(),
            'summary' => Reviews::summarize(is_array($bundle['reviews'] ?? null) ? $bundle['reviews'] : null, (int) ($page['totalCount'] ?? 0)),
            'sources' => Reviews::sourcesIn($newest['items'] ?? $items),
            'source' => $source,
            'reviews' => $items,
            'moreHref' => $next !== null && $shown < self::MOST_SHOWN
                ? route('reviews', array_filter(['source' => $source, 'shown' => $shown + Reviews::PAGE_SIZE]), false).'#review-'.$shown
                : null,
            'signedIn' => $this->session($request) !== null,
        ]);
    }

    /** `{ rating, title?, body }` from <bd-review-writer>, for the signed-in customer. */
    public function write(Request $request): JsonResponse
    {
        if (! Bd::configured()) {
            return $this->json(['ok' => false, 'error' => "Reviews aren't connected yet."], 503);
        }
        if (! $request->isJson()) {
            return $this->json(['ok' => false, 'error' => 'Send JSON.'], 415);
        }
        $session = $this->session($request);
        $token = $request->cookie(config('bd.session_cookie'));
        if (! $session || ! is_string($token)) {
            return $this->json(['ok' => false, 'error' => 'Sign in to write a review.'], 401);
        }
        $checked = Reviews::check((array) $request->json()->all());
        if (! $checked['ok']) {
            return $this->json(['ok' => false, 'error' => $checked['error']], 400);
        }
        $review = $checked['review'];
        $sent = Bd::attempt(static fn (Client $c) => $c
            ->portal($token, $session['organizationId'] ?? null)
            ->submitReview($review), default: null);

        return $sent === null
            ? $this->json(['ok' => false, 'error' => "Couldn't send your review. Try again."], 502)
            : $this->json(['ok' => true]);
    }

    /**
     * The first `$shown` reviews, newest first, a page of up to 50 at a time.
     *
     * @return array{items: list<array<string, mixed>>, totalCount: int, nextOffset: int|null}
     */
    private static function firstReviews(Client $c, int $shown, ?string $source): array
    {
        $items = [];
        $next = 0;
        $total = 0;
        while ($next !== null && count($items) < $shown) {
            $page = $c->reviews()->list(limit: min(50, $shown - count($items)), offset: $next, source: $source);
            $items = [...$items, ...($page['items'] ?? [])];
            $total = (int) ($page['totalCount'] ?? count($items));
            $next = isset($page['nextOffset']) && is_int($page['nextOffset']) ? $page['nextOffset'] : null;
            if (($page['items'] ?? []) === []) {
                break;
            }
        }

        return ['items' => $items, 'totalCount' => $total, 'nextOffset' => $next];
    }

    /** @return array<string, mixed>|null */
    private function session(Request $request): ?array
    {
        $auth = Auth::fromConfig();
        $cookie = $request->cookie(config('bd.session_cookie'));

        return $auth && is_string($cookie) && $cookie !== '' ? $auth->session($cookie) : null;
    }

    private function json(array $body, int $status = 200): JsonResponse
    {
        return response()->json($body, $status)->header('Cache-Control', 'no-store');
    }
}
