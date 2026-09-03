<?php

namespace App\Http\Controllers;

use App\Bd\Bd;
use App\Bd\Client;
use Illuminate\View\View;

/**
 * Programmatic SEO: `/services/{service}/{area}`.
 *
 * The platform renders the copy from one template × the variant tuples the
 * org defines, so a hundred landing pages stay editable in the dashboard
 * instead of being generated and forgotten in this repo.
 */
class ServiceAreaController extends Controller
{
    private const PAGE_KEY = 'service-area';

    public function index(): View
    {
        $variants = Bd::remember(
            'parallel:service-area:variants',
            ['bd:parallel-pages'],
            static fn (Client $c) => $c->parallelPages()->listVariants(self::PAGE_KEY),
            default: ['variants' => []],
        );

        return view('pages.services', [
            'variants' => $variants['variants'] ?? [],
        ]);
    }

    public function show(string $service, string $area): View
    {
        $key = 'parallel:service-area:'.md5($service.'|'.$area);

        $page = Bd::remember(
            $key,
            ['bd:parallel-pages'],
            static fn (Client $c) => $c->parallelPages()->render(self::PAGE_KEY, [
                'service' => $service,
                'area' => $area,
            ]),
            default: null,
        );

        abort_if($page === null, 404);

        return view('pages.service-area', [
            'page' => $page,
            'service' => $service,
            'area' => $area,
        ]);
    }
}
