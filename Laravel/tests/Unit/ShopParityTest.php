<?php

namespace Tests\Unit;

use App\Support\Shop;
use PHPUnit\Framework\TestCase;

/**
 * Replays shop-parity.json: products, and what the product page rules every
 * BD starter shares (shop.ts) give back. The page is drawn here as it opens
 * and <bd-product-form> takes over in the browser with the TypeScript, so
 * the two must agree, or the price or photos would jump once it loads.
 */
final class ShopParityTest extends TestCase
{
    public function test_the_product_rules_agree_with_typescript(): void
    {
        $fixture = json_decode((string) file_get_contents(__DIR__.'/../Fixtures/shop-parity.json'), true);
        $this->assertNotEmpty($fixture['cases']);

        foreach ($fixture['cases'] as $case) {
            $view = Shop::productView($case['input']);
            $name = json_encode($case['input']['id'] ?? null);

            $this->assertEquals($case['view'], $view, "productView $name");
            $this->assertSame($case['defaultVariant'], Shop::defaultVariant($view)['id'] ?? null, "defaultVariant $name");
            $this->assertEquals($case['allOptionGroups'], Shop::allOptionGroups($view), "allOptionGroups $name");
            $this->assertEquals($case['photoSets'], Shop::photoSets($view), "photoSets $name");
            $this->assertEquals($case['unknownVariant']['gallery'], Shop::galleryFor($view, 'nope'), "galleryFor unknown $name");
            $this->assertEquals($case['unknownVariant']['price'], Shop::priceFor($view, 'nope'), "priceFor unknown $name");

            foreach ($case['variants'] as $variant) {
                $at = "$name variant {$variant['id']}";
                $this->assertEquals($variant['gallery'], Shop::galleryFor($view, $variant['id']), "galleryFor $at");
                $this->assertEquals($variant['groups'], Shop::optionGroupsFor($view, $variant['id']), "optionGroupsFor $at");
                foreach ($variant['prices'] as $row) {
                    $with = $at.' chosen '.json_encode($row['chosen']);
                    $this->assertEquals($row['price'], Shop::priceFor($view, $variant['id'], $row['chosen']), "priceFor $with");
                    $this->assertEquals($row['summary'], Shop::productSummary($view, $variant['id'], $row['chosen']), "productSummary $with");
                }
            }
        }
    }
}
