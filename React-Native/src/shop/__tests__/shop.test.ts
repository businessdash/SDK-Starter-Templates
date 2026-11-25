import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { formatPostDate, readingMinutes, safePostHtml } from '../blog'
import { type PostBlock, plainText, postBlocks } from '../post-blocks'
import { checkReview, reviewLink, summarizeReviews } from '../reviews'
import { chosenOptions, defaultVariant, galleryFor, optionGroupsFor, priceFor, toProductView } from '../shop'

// Post HTML in, and what safePostHtml gives back; every BD starter checks
// its port against the same cases.
const parity = JSON.parse(readFileSync(new URL('./post-html-parity.json', import.meta.url), 'utf8')) as {
  cases: { input: string; output: string }[]
}

describe('post HTML', () => {
  it('cleans the same as every other starter', () => {
    assert.ok(parity.cases.length >= 20)
    for (const { input, output } of parity.cases) assert.equal(safePostHtml(input), output, input)
  })

  it('reads as blocks, with scripts and unsafe links gone', () => {
    const blocks = postBlocks(`
      <h2>Weeks 1 to 3</h2><p>Run <strong>easy</strong> &amp; <a href="https://example.com/x">read this</a>
      <a href="javascript:alert(1)">bad</a> <a href="/store">ours</a></p>
      <script>alert(1)</script>
      <ul><li>Monday<ul><li>20 min</li></ul>then rest</li><li>Friday</li></ul>
      <ol start="3"><li>Third</li></ol>
      <img src="https://img.example/a.jpg" alt="Shoe"><img src="/local.jpg">
      <blockquote>Easy means talking.</blockquote><pre>let x = 1</pre><hr>
    `)

    const [heading, paragraph, list, numbered, image, quote, code, rule] = blocks as PostBlock[]
    assert.deepEqual(blocks.length, 8)

    assert.equal(heading.kind, 'heading')
    if (heading.kind === 'heading') {
      assert.equal(heading.level, 2)
      assert.equal(plainText(heading.text), 'Weeks 1 to 3')
    }

    assert.equal(paragraph.kind, 'paragraph')
    if (paragraph.kind === 'paragraph') {
      assert.equal(plainText(paragraph.text), 'Run easy & read this bad ours')
      assert.deepEqual(
        paragraph.text.filter((run) => run.link).map((run) => run.link),
        ['https://example.com/x'],
      )
      assert.ok(paragraph.text.some((run) => run.bold && run.text === 'easy'))
    }

    assert.equal(list.kind, 'list')
    if (list.kind === 'list') {
      assert.deepEqual(
        list.items.map((item) => item.marker),
        ['•', '◦', '', '•'],
      )
      assert.deepEqual(
        list.items.map((item) => plainText(item.text)),
        ['Monday', '20 min', 'then rest', 'Friday'],
      )
      assert.deepEqual(
        list.items.map((item) => item.depth),
        [0, 1, 0, 0],
      )
    }

    assert.equal(numbered.kind === 'list' && numbered.items[0]?.marker, '3.')
    assert.deepEqual(image, { kind: 'image', url: 'https://img.example/a.jpg', alt: 'Shoe' })
    assert.equal(quote.kind, 'quote')
    assert.deepEqual(code, { kind: 'code', text: 'let x = 1' })
    assert.deepEqual(rule, { kind: 'rule' })
  })

  it('keeps tables, captions, phone and mail links', () => {
    const blocks = postBlocks(
      '<figure><img src="https://img.example/b.jpg" alt=""><figcaption>Our <em>shop</em></figcaption></figure>' +
        '<table><thead><tr><th>Size</th><th>Drop</th></tr></thead><tbody><tr><td>S</td><td>8 mm</td></tr></tbody></table>' +
        '<p><a href="tel:+15551234567">Call</a> or <a href="mailto:hi@example.com">write</a></p>',
    )
    assert.deepEqual(
      blocks.map((block) => block.kind),
      ['image', 'caption', 'table', 'paragraph'],
    )
    const table = blocks[2]
    if (table.kind === 'table') {
      assert.deepEqual(
        table.rows.map((row) => [row.isHeader, row.cells.map(plainText)]),
        [
          [true, ['Size', 'Drop']],
          [false, ['S', '8 mm']],
        ],
      )
    }
    const paragraph = blocks[3]
    if (paragraph.kind === 'paragraph') {
      assert.deepEqual(
        paragraph.text.filter((run) => run.link).map((run) => run.link),
        ['tel:+15551234567', 'mailto:hi@example.com'],
      )
    }
  })

  it('times and dates a post', () => {
    assert.equal(readingMinutes(`<p>${'word '.repeat(700)}</p>`), 3)
    assert.equal(formatPostDate('2026-11-18T15:00:00.000Z', 'en-US'), 'November 18, 2026')
  })
})

describe('product page', () => {
  const shoe = toProductView({
    id: 'p1',
    name: 'Trainer',
    category: { name: 'Shoes' },
    productImages: [
      { url: 'b.jpg', order: 2 },
      { url: 'a.jpg', order: 1 },
    ],
    variants: [
      { id: 'v1', name: 'Blue', price: 120, stock: 0 },
      { id: 'v2', name: 'Black', price: 120 },
    ],
    variantImages: [{ variantId: 'v2', url: 'black.jpg', order: 1 }],
    crossVariantTitles: [{ id: 't1', title: 'Size', variantId: null }],
    crossVariants: [
      { id: 'o3', crossVariantTitleId: 't1', value: 'L', price: 125, stock: 3 },
      { id: 'o1', crossVariantTitleId: 't1', value: 'S', price: 120 },
      { id: 'o2', crossVariantTitleId: 't1', value: 'M', price: 120, isLive: false },
    ],
    specifications: {
      features: ['Light'],
      groups: [
        {
          name: 'Fit',
          rows: [
            { label: 'Drop', value: '8 mm' },
            { label: '', value: 'x' },
          ],
        },
      ],
    },
  })

  it('opens on the first variant that can be bought, with its own photos', () => {
    assert.equal(defaultVariant(shoe)?.id, 'v2')
    assert.deepEqual(galleryFor(shoe, 'v2'), ['black.jpg'])
    assert.deepEqual(galleryFor(shoe, 'v1'), ['a.jpg', 'b.jpg'])
    assert.equal(shoe.categoryName, 'Shoes')
    assert.deepEqual(shoe.specs, [{ name: 'Fit', rows: [{ label: 'Drop', value: '8 mm' }] }])
  })

  it("sorts sizes smallest first; the price is 'from' until every group is chosen", () => {
    assert.deepEqual(
      optionGroupsFor(shoe, 'v2')[0]?.values.map((value) => value.value),
      ['S', 'M', 'L'],
    )
    const open = priceFor(shoe, 'v2', {})
    assert.equal(open.amount, 120)
    assert.equal(open.from, true)
    assert.equal(open.ready, false)
    const large = priceFor(shoe, 'v2', { t1: 'o3' })
    assert.equal(large.amount, 125)
    assert.equal(large.from, false)
    assert.equal(large.stock, 3)
    assert.equal(large.ready, true)
    assert.deepEqual(chosenOptions(shoe, 'v2', { t1: 'o3' }), { Size: 'L' })
    assert.equal(priceFor(shoe, 'v2', { t1: 'o2' }).ready, false)
    assert.equal(priceFor(shoe, 'v1', {}).amount, null)
  })
})

describe('reviews', () => {
  it('summarizes from the bundle counts', () => {
    const summary = summarizeReviews({
      rating: 4.1,
      totalCount: 14,
      counts: [
        { rating: 5, count: 8 },
        { rating: 4, count: 3 },
        { rating: 3, count: 1 },
        { rating: 2, count: 1 },
        { rating: 1, count: 1 },
      ],
    })
    assert.equal(summary.average, 4.1)
    assert.deepEqual(
      summary.histogram.map((row) => row.count),
      [8, 3, 1, 1, 1],
    )
  })

  it('links out only over http(s); a review needs stars and words, its title up to 200', () => {
    assert.equal(reviewLink({ source: 'google', reviewUrl: 'javascript:alert(1)' }), null)
    assert.equal(reviewLink({ source: 'yelp', reviewUrl: 'https://yelp.com/r/1' }), 'https://yelp.com/r/1')
    assert.equal(checkReview({ rating: 0, body: 'Great' }).ok, false)
    assert.equal(checkReview({ rating: 5, body: 'x'.repeat(5001) }).ok, false)
    const long = checkReview({ rating: 5, title: 'x'.repeat(250), body: 'Great' })
    assert.equal(long.ok && long.review.title?.length, 200)
  })
})
