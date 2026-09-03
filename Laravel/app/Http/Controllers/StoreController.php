<?php

namespace App\Http\Controllers;

use App\Bd\Bd;
use App\Bd\Client;
use Illuminate\Http\Request;
use Illuminate\View\View;

class StoreController extends Controller
{
    public function index(Request $request): View
    {
        $search = $request->query('search');
        $categoryId = $request->query('categoryId');
        $sort = $request->query('sort');
        $cacheKey = 'storefront:grid:'.md5(json_encode([$search, $categoryId, $sort]));

        $grid = Bd::remember(
            $cacheKey,
            ['bd:storefront'],
            static fn (Client $c) => $c->storefront()->listProductsWithMeta(
                search: is_string($search) ? $search : null,
                categoryId: is_string($categoryId) ? $categoryId : null,
                sort: is_string($sort) ? $sort : null,
                limit: 24,
            ),
            default: ['items' => [], 'categoryCounts' => []],
        );

        $categories = Bd::remember(
            'storefront:categories',
            ['bd:storefront'],
            static fn (Client $c) => $c->storefront()->listCategories(),
            default: ['items' => []],
        );

        return view('pages.store', [
            'products' => $grid['items'] ?? [],
            'categoryCounts' => $grid['categoryCounts'] ?? [],
            'priceRange' => $grid['priceRange'] ?? null,
            'categories' => $categories['items'] ?? [],
            'search' => is_string($search) ? $search : '',
        ]);
    }

    public function show(string $id): View
    {
        $product = Bd::remember(
            "storefront:product:{$id}",
            ['bd:storefront'],
            static fn (Client $c) => $c->storefront()->getProduct($id),
            default: null,
        );

        abort_if($product === null, 404);

        $related = Bd::remember(
            "storefront:related:{$id}",
            ['bd:storefront'],
            static fn (Client $c) => $c->storefront()->getRelatedProducts($id, limit: 4),
            default: ['items' => []],
        );

        $reviews = Bd::remember(
            "storefront:reviews:{$id}",
            ['bd:storefront', 'bd:reviews'],
            static fn (Client $c) => $c->storefront()->getProductReviews($id, limit: 5),
            default: ['items' => []],
        );

        return view('pages.product', [
            'product' => $product,
            'related' => $related['items'] ?? [],
            'reviews' => $reviews['items'] ?? [],
        ]);
    }
}
