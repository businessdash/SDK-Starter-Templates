<?php

namespace App\Support;

/**
 * The product page's rules, the same as every BD starter's (see
 * public/shop/shop.js, which the browser uses): shaping a product for its
 * page, which photos show for an option, what "from $40" means, and the
 * product as the saved lists keep it.
 *
 * The page is drawn here as it opens (the first variant that can be bought,
 * nothing else chosen); <bd-gallery> and <bd-product-form> take over from
 * there in the browser.
 *
 * Money: variants and options carry DOLLARS; product cards and saved
 * products carry integer CENTS.
 */
class Shop
{
    private const SIZE_ORDER = ['XXS', '2XS', 'XS', 'S', 'SM', 'M', 'MD', 'L', 'LG', 'XL', '2XL', 'XXL', '3XL', '4XL'];

    /**
     * Shape a `storefront.getProduct` response for the product page.
     *
     * @return array{id: string, name: string, description: string, categoryId: ?string, categoryName: ?string, images: list<string>, variants: list<array{id: string, name: string, price: int|float|null, stock: int|float|null, available: bool}>, variantImages: list<array{variantId: string, url: string, order: int|float}>, optionTitles: list<array{id: string, title: string, variantId: ?string}>, optionValues: list<array{id: string, titleId: string, value: string, price: int|float, stock: int|float|null, available: bool}>, features: list<string>, specs: list<array{name: string, rows: list<array{label: string, value: string}>}>}
     */
    public static function productView(array $product): array
    {
        $category = is_array($product['category'] ?? null) ? $product['category'] : null;

        $productImages = array_values(array_filter(
            array_map(
                fn ($image) => ['url' => self::text($image['url'] ?? null), 'order' => self::num($image['order'] ?? null) ?? 0],
                self::records($product['productImages'] ?? null),
            ),
            fn ($image) => $image['url'] !== '',
        ));
        usort($productImages, fn ($a, $b) => $a['order'] <=> $b['order']);
        $images = is_array($product['images'] ?? null)
            ? array_values(array_filter(array_map(fn ($url) => self::text($url), $product['images'])))
            : [];

        $specs = self::specs($product['specifications'] ?? null);

        return [
            'id' => self::text($product['id'] ?? null),
            'name' => self::text($product['name'] ?? null) ?: 'Untitled',
            'description' => self::text($product['description'] ?? null),
            'categoryId' => self::text($product['categoryId'] ?? null) ?: null,
            'categoryName' => $category ? (self::text($category['name'] ?? null) ?: null) : null,
            'images' => $images ?: array_column($productImages, 'url'),
            'variants' => array_map(fn ($variant) => [
                'id' => self::text($variant['id'] ?? null),
                'name' => self::text($variant['name'] ?? null) ?: 'Default',
                'price' => self::num($variant['price'] ?? null),
                'stock' => self::num($variant['stock'] ?? null),
                'available' => ($variant['isLive'] ?? null) !== false && ! self::isZero($variant['stock'] ?? null),
            ], self::records($product['variants'] ?? null)),
            'variantImages' => array_values(array_filter(
                array_map(fn ($image) => [
                    'variantId' => self::text($image['variantId'] ?? null),
                    'url' => self::text($image['url'] ?? null),
                    'order' => self::num($image['order'] ?? null) ?? 0,
                ], self::records($product['variantImages'] ?? null)),
                fn ($image) => $image['url'] !== '',
            )),
            'optionTitles' => array_map(fn ($title) => [
                'id' => self::text($title['id'] ?? null),
                'title' => self::text($title['title'] ?? null),
                'variantId' => self::text($title['variantId'] ?? null) ?: null,
            ], self::records($product['crossVariantTitles'] ?? null)),
            'optionValues' => array_map(fn ($option) => [
                'id' => self::text($option['id'] ?? null),
                'titleId' => self::text($option['crossVariantTitleId'] ?? null),
                'value' => self::text($option['value'] ?? null),
                'price' => self::num($option['price'] ?? null) ?? 0,
                'stock' => self::num($option['stock'] ?? null),
                'available' => ($option['isLive'] ?? null) !== false && ! self::isZero($option['stock'] ?? null),
            ], self::records($product['crossVariants'] ?? null)),
            'features' => $specs['features'],
            'specs' => $specs['specs'],
        ];
    }

    /** The variant a page opens on: the first one that can be bought. */
    public static function defaultVariant(array $view): ?array
    {
        foreach ($view['variants'] as $variant) {
            if ($variant['available']) {
                return $variant;
            }
        }

        return $view['variants'][0] ?? null;
    }

    /** The photos for a variant: its own when it has any, else the product's. */
    public static function galleryFor(array $view, string $variantId): array
    {
        $own = array_values(array_filter($view['variantImages'], fn ($image) => $image['variantId'] === $variantId));
        usort($own, fn ($a, $b) => $a['order'] <=> $b['order']);

        return $own ? array_column($own, 'url') : $view['images'];
    }

    /** The option groups (Size, Colour…) that apply to a variant. */
    public static function optionGroupsFor(array $view, string $variantId): array
    {
        $groups = [];
        foreach ($view['optionTitles'] as $title) {
            if ($title['variantId'] !== null && $title['variantId'] !== $variantId) {
                continue;
            }
            $group = self::groupOf($view, $title);
            if ($group['values']) {
                $groups[] = $group;
            }
        }

        return $groups;
    }

    /**
     * Every option group, with the variant it belongs to (null: every
     * variant). The page draws them all; <bd-product-form> shows the ones for
     * the chosen variant.
     */
    public static function allOptionGroups(array $view): array
    {
        $groups = [];
        foreach ($view['optionTitles'] as $title) {
            $group = self::groupOf($view, $title) + ['variantId' => $title['variantId']];
            if ($group['values']) {
                $groups[] = $group;
            }
        }

        return $groups;
    }

    /**
     * The sets of photos the page draws: the product's (variant ""), then
     * one per variant with photos of its own. <bd-gallery> shows the chosen
     * variant's set, or the product's.
     */
    public static function photoSets(array $view): array
    {
        $sets = [['variantId' => '', 'photos' => $view['images']]];
        $seen = [];
        foreach ($view['variantImages'] as $image) {
            $id = $image['variantId'];
            if ($id === '' || isset($seen[$id])) {
                continue;
            }
            $seen[$id] = true;
            $sets[] = ['variantId' => $id, 'photos' => self::galleryFor($view, $id)];
        }

        return $sets;
    }

    /**
     * The price shown for a variant and the options chosen so far (`$chosen`
     * maps an option group's id to an option value's id).
     *
     * @return array{amount: int|float|null, from: bool, stock: int|float|null, ready: bool}
     */
    public static function priceFor(array $view, string $variantId, array $chosen = []): array
    {
        $variant = null;
        foreach ($view['variants'] as $candidate) {
            if ($candidate['id'] === $variantId) {
                $variant = $candidate;
                break;
            }
        }
        if (! $variant || ! $variant['available']) {
            return ['amount' => null, 'from' => false, 'stock' => 0, 'ready' => false];
        }
        $groups = self::optionGroupsFor($view, $variantId);
        if (! $groups) {
            return ['amount' => $variant['price'], 'from' => false, 'stock' => $variant['stock'], 'ready' => true];
        }
        $picks = [];
        foreach ($groups as $group) {
            $pick = null;
            foreach ($group['values'] as $value) {
                if ($value['id'] === ($chosen[$group['id']] ?? null)) {
                    $pick = $value;
                    break;
                }
            }
            $picks[] = $pick;
        }
        if (in_array(null, $picks, true)) {
            $lowest = 0;
            foreach ($groups as $group) {
                $open = array_filter($group['values'], fn ($value) => $value['available']);
                $lowest += $open ? min(array_column($open, 'price')) : 0;
            }

            return ['amount' => $lowest, 'from' => true, 'stock' => null, 'ready' => false];
        }
        foreach ($picks as $pick) {
            if (! $pick['available']) {
                return ['amount' => null, 'from' => false, 'stock' => 0, 'ready' => false];
            }
        }
        $stocks = array_values(array_filter(array_column($picks, 'stock'), fn ($stock) => $stock !== null));

        return [
            'amount' => array_sum(array_column($picks, 'price')),
            'from' => false,
            'stock' => $stocks ? min($stocks) : null,
            'ready' => true,
        ];
    }

    /**
     * The product as the saved lists keep it, priced for what's chosen.
     *
     * @return array{id: string, name: string, image: ?string, priceCents: ?int}
     */
    public static function productSummary(array $view, string $variantId, array $chosen = []): array
    {
        $start = self::priceFor($view, $variantId, $chosen)['amount'] ?? ($view['variants'][0]['price'] ?? null);

        return [
            'id' => $view['id'],
            'name' => $view['name'],
            'image' => $view['images'][0] ?? null,
            'priceCents' => $start !== null ? (int) round($start * 100) : null,
        ];
    }

    /** A related product as a card in a rail. */
    public static function relatedCard(array $related): array
    {
        $dollars = self::num($related['minPriceDollars'] ?? null);

        return [
            'id' => self::text($related['id'] ?? null),
            'name' => self::text($related['name'] ?? null),
            'image' => self::text($related['coverImageUrl'] ?? null) ?: null,
            'priceCents' => $dollars !== null ? (int) round($dollars * 100) : null,
        ];
    }

    /** The variant an add-on is added as: its first. */
    public static function addonVariant(array $addon): ?string
    {
        $first = is_array($addon['variants'] ?? null) ? ($addon['variants'][0] ?? null) : null;
        $id = is_array($first) ? ($first['variantId'] ?? $first['id'] ?? null) : null;

        return is_string($id) ? $id : null;
    }

    /**
     * The store list with some filters changed (null or "" removes one);
     * `$query` is the list's filters as they are (StoreController@index).
     */
    public static function storeHref(array $query, array $changes = []): string
    {
        $next = array_filter(array_merge($query, $changes), static fn ($v) => $v !== null && $v !== '');

        return route('store').($next ? '?'.http_build_query($next) : '');
    }

    /** A review's date, as "Mar 4, 2026". */
    public static function reviewDate(mixed $iso): string
    {
        if (! is_string($iso) || $iso === '') {
            return '';
        }
        $time = strtotime($iso);

        return $time === false ? '' : date('M j, Y', $time);
    }

    /** One option group's choices, sizes in size order. */
    private static function groupOf(array $view, array $title): array
    {
        $values = array_values(array_filter($view['optionValues'], fn ($option) => $option['titleId'] === $title['id']));
        if (preg_match('/^sizes?$/i', $title['title'])) {
            $rank = function (string $value): int {
                $i = array_search(strtoupper($value), self::SIZE_ORDER, true);

                return $i === false ? count(self::SIZE_ORDER) : $i;
            };
            usort($values, fn ($a, $b) => $rank($a['value']) <=> $rank($b['value']));
        }

        return ['id' => $title['id'], 'title' => $title['title'], 'values' => $values];
    }

    /** Read the specifications column (`{ features, groups: [{ name, rows }] }`). */
    private static function specs(mixed $raw): array
    {
        $raw = is_array($raw) ? $raw : [];
        $features = is_array($raw['features'] ?? null)
            ? array_values(array_filter(array_map(fn ($f) => self::text($f), $raw['features'])))
            : [];
        $specs = [];
        foreach (self::records($raw['groups'] ?? null) as $group) {
            $rows = [];
            foreach (self::records($group['rows'] ?? null) as $row) {
                $label = self::text($row['label'] ?? null);
                $value = self::text($row['value'] ?? null);
                if ($label !== '' && $value !== '') {
                    $rows[] = ['label' => $label, 'value' => $value];
                }
            }
            $name = self::text($group['name'] ?? null);
            if ($name !== '' && $rows) {
                $specs[] = ['name' => $name, 'rows' => $rows];
            }
        }

        return ['features' => $features, 'specs' => $specs];
    }

    private static function text(mixed $value): string
    {
        return is_string($value) ? trim($value) : '';
    }

    private static function num(mixed $value): int|float|null
    {
        return (is_int($value) || is_float($value)) && is_finite((float) $value) ? $value : null;
    }

    /** A stock of none: sold out. (No stock count means it isn't tracked.) */
    private static function isZero(mixed $value): bool
    {
        $n = self::num($value);

        return $n !== null && $n == 0;
    }

    /** @return list<array<string, mixed>> */
    private static function records(mixed $value): array
    {
        return is_array($value) ? array_values(array_filter($value, 'is_array')) : [];
    }
}
