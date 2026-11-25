<?php

namespace App\Http\Controllers;

use App\Bd\Bd;
use App\Bd\BdAccessRejectedException;
use App\Bd\BdApiException;
use App\Bd\Client;
use App\Support\CartVisitor;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\View\View;

/**
 * The store: the product list with its filters, one product, the wishlist,
 * the comparison and the order confirmation.
 *
 * The product page, wishlist, compare table and save buttons are custom
 * elements (public/shop/shop-elements.js), the same ones every BD starter
 * ships. This controller reads the data on the server and the view writes it
 * into the element as JSON; the element draws the page in the browser.
 */
class StoreController extends Controller
{
    /** The sorts the list offers, in order. */
    public const SORTS = [
        'featured' => 'Featured',
        'newest' => 'Newest',
        'price-asc' => 'Price: low to high',
        'price-desc' => 'Price: high to low',
        'rating-desc' => 'Top rated',
    ];

    /** Reviews shown at first, and how many more each "Show more" adds. */
    private const REVIEWS_PAGE = 10;

    /**
     * The filters live in the URL (?q, ?category, ?priceMin, ?priceMax,
     * ?rating, ?sort) and are links, so a filtered list can be shared and the
     * back button steps through them.
     */
    public function index(Request $request): View
    {
        $text = static fn (string $key): ?string => is_string($v = $request->query($key)) && trim($v) !== '' ? trim($v) : null;
        $cents = static function (?string $value): ?int {
            return $value !== null && is_numeric($value) && (float) $value >= 0 ? (int) round((float) $value * 100) : null;
        };
        $rating = (int) $request->query('rating');
        $sort = $text('sort');
        $filters = [
            'search' => $text('q'),
            'categoryId' => $text('category'),
            'minPriceCents' => $cents($text('priceMin')),
            'maxPriceCents' => $cents($text('priceMax')),
            'minRating' => $rating >= 1 && $rating <= 5 ? $rating : null,
            'sort' => $sort !== null && isset(self::SORTS[$sort]) ? $sort : 'featured',
        ];

        $listing = Bd::remember(
            'storefront:listing:'.md5(json_encode($filters)),
            ['bd:storefront'],
            static fn (Client $c) => $c->storefront()->listProductsWithMeta(...$filters, limit: 48),
            default: null,
        );
        $categories = Bd::remember(
            'storefront:categories',
            ['bd:storefront'],
            static fn (Client $c) => $c->storefront()->listCategories(),
            default: ['items' => []],
        );

        $query = array_filter($request->only(['q', 'category', 'priceMin', 'priceMax', 'rating', 'sort']), 'is_string');

        return view('pages.store', [
            'configured' => Bd::configured(),
            'listing' => $listing,
            'products' => $listing['items'] ?? [],
            'counts' => collect($listing['categoryCounts'] ?? [])->pluck('count', 'categoryId')->all(),
            'priceRange' => $listing['priceRange'] ?? null,
            'categories' => $categories['items'] ?? [],
            'query' => $query,
            'filters' => $filters,
            'hasFilters' => array_intersect_key($query, array_flip(['q', 'category', 'priceMin', 'priceMax', 'rating'])) !== [],
            'cartCount' => CartVisitor::itemCount($request),
        ]);
    }

    public function show(Request $request, string $id): Response
    {
        $asked = (int) $request->query('reviews');
        $reviewLimit = min(100, $asked > self::REVIEWS_PAGE ? $asked : self::REVIEWS_PAGE);

        $data = null;
        $unavailable = false;
        $client = Bd::client();
        if ($client) {
            try {
                $product = $client->storefront()->getProduct($id);
                $reviews = $this->quietly(static fn () => $client->storefront()->getProductReviews($id, limit: $reviewLimit));
                $addons = $this->quietly(static fn () => $client->storefront()->getProductAddons($id));
                $related = $this->quietly(static fn () => $client->storefront()->getRelatedProducts($id, limit: 6));
                $total = (int) data_get($reviews, 'totalCount', 0);
                $data = [
                    'product' => $product,
                    'reviews' => $reviews,
                    'addons' => $addons['items'] ?? [],
                    'related' => $related['items'] ?? [],
                    'moreReviewsHref' => $reviews && $total > count($reviews['items'] ?? [])
                        ? route('store.product', $id).'?reviews='.($reviewLimit + self::REVIEWS_PAGE).'#reviews'
                        : null,
                ];
            } catch (BdAccessRejectedException $e) {
                $unavailable = Bd::isUnavailable($e);
                report($e);
            } catch (BdApiException $e) {
                report($e);
            }
        }

        // Not found is a 404, so the page isn't indexed; the store bar and a
        // link back still show.
        return response()->view('pages.product', [
            'configured' => $client !== null,
            'unavailable' => $unavailable,
            'data' => $data,
            'cartCount' => CartVisitor::itemCount($request),
        ], $client && ! $data ? 404 : 200);
    }

    /** Products saved on this device with ♡ Save; `<bd-wishlist>` draws them there. */
    public function wishlist(Request $request): View
    {
        return view('pages.wishlist', ['cartCount' => CartVisitor::itemCount($request)]);
    }

    /**
     * Up to four products side by side. The products come from ?ids=a,b, so
     * a comparison can be shared; opened without ids, `<bd-compare>` moves
     * this browser's picks into the URL.
     */
    public function compare(Request $request): View
    {
        $ids = array_slice(array_values(array_filter(array_map(
            'trim',
            explode(',', (string) $request->query('ids', '')),
        ))), 0, 4);

        $columns = [];
        $client = Bd::client();
        if ($client) {
            foreach ($ids as $id) {
                try {
                    $product = $client->storefront()->getProduct($id);
                } catch (BdAccessRejectedException|BdApiException) {
                    continue;
                }
                $reviews = $this->quietly(static fn () => $client->storefront()->getProductReviews($id, limit: 1));
                $count = (int) data_get($reviews, 'totalCount', 0);
                $columns[] = [
                    'product' => $product,
                    'rating' => $count > 0 ? ['avg' => data_get($reviews, 'avgRating'), 'count' => $count] : null,
                ];
            }
        }

        return view('pages.compare', [
            'compare' => ['ids' => $ids, 'columns' => $columns],
            'cartCount' => CartVisitor::itemCount($request),
        ]);
    }

    /** Back from Stripe: `checkout/{sessionId}` says whether the order is paid. */
    public function order(Request $request): View
    {
        $sessionId = $request->query('session_id');
        $status = is_string($sessionId) && $sessionId !== ''
            ? Bd::attempt(static fn (Client $c) => $c->checkout()->get($sessionId), default: null)
            : null;

        return view('pages.order', [
            'paid' => data_get($status, 'paymentStatus') === 'paid',
            'email' => data_get($status, 'customerEmail'),
            'cartCount' => CartVisitor::itemCount($request),
        ]);
    }

    /** A read that may fail without failing the page. */
    private function quietly(callable $read): ?array
    {
        try {
            return $read();
        } catch (BdAccessRejectedException|BdApiException $e) {
            report($e);

            return null;
        }
    }
}
