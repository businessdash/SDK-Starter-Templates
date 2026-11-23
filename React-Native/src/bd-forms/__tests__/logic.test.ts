import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

import {
  contrastingText,
  decodeEntities,
  formatBytes,
  formatNumber,
  formatPhone,
  formatTime,
  htmlSpans,
  htmlToMarkup,
  markupToHtml,
  normalizeHex,
  parseDay,
  parseNumber,
  parseTime,
  safeHttpUrl,
  safeLink,
  sanitizeNumber,
  spansText,
  tableCheckState,
  timesOfDay,
  toggleListLine,
  wrapSelection,
} from '../logic'

const at = (text: string, start: number, end = start) => ({ text, start, end })

describe("rich text: the editor's markup and the HTML BD keeps", () => {
  it('paragraphs and inline formatting become BD HTML', () => {
    assert.equal(
      markupToHtml('Hello **bold** and *soft* and ~~gone~~\nSecond'),
      '<p>Hello <strong>bold</strong> and <em>soft</em> and <s>gone</s></p><p>Second</p>',
    )
  })

  it('lists group consecutive items', () => {
    assert.equal(
      markupToHtml('Intro\n• one\n- two\n1. first\n2. second'),
      '<p>Intro</p><ul><li>one</li><li>two</li></ul><ol><li>first</li><li>second</li></ol>',
    )
  })

  it("blank lines survive but trailing ones don't", () => {
    assert.equal(markupToHtml('a\n\nb\n\n'), '<p>a</p><p><br></p><p>b</p>')
    assert.equal(markupToHtml('  \n '), '')
  })

  it('typed markup is escaped, not injected', () => {
    assert.equal(
      markupToHtml('<script>x</script> & 2*3*4'),
      '<p>&lt;script&gt;x&lt;/script&gt; &amp; 2*3*4</p>',
    )
  })

  it('stored HTML round-trips through the editor', () => {
    const html =
      '<p>Hello <strong>bold</strong> <em>soft</em></p><p><br></p><ul><li>one</li><li>two</li></ul><ol><li>a</li></ol>'
    const markup = htmlToMarkup(html)
    assert.equal(markup, 'Hello **bold** *soft*\n\n• one\n• two\n1. a')
    assert.equal(markupToHtml(markup), html)
  })

  it('wrap puts markers around the selection and takes them off', () => {
    const wrapped = wrapSelection(at('make bold', 5, 9), '**')
    assert.deepEqual(wrapped, at('make **bold**', 7, 11))
    assert.equal(wrapSelection(wrapped, '**').text, 'make bold')
    assert.deepEqual(wrapSelection(at('ab', 1), '*'), at('a**b', 2))
  })

  it('pressing a format button again turns it off', () => {
    assert.deepEqual(wrapSelection(at('a ****', 4), '**'), at('a ', 2))
    assert.deepEqual(wrapSelection(at('make **bold**', 11), '**'), at('make **bold**', 13))
    assert.equal(wrapSelection(at('**bold**', 6), '*').text, '**bold****')
    assert.deepEqual(wrapSelection(at('x **y**', 2), '**'), at('x ******y**', 4))
  })

  it('the list toggle adds, switches and removes the marker', () => {
    const bullet = toggleListLine(at('one\ntwo', 5), false)
    assert.equal(bullet.text, 'one\n• two')
    const numbered = toggleListLine(bullet, true)
    assert.equal(numbered.text, 'one\n1. two')
    assert.equal(toggleListLine(numbered, true).text, 'one\ntwo')
    assert.equal(toggleListLine(at('1. a\nb', 6), true).text, '1. a\n2. b')
  })
})

describe('reading richtext content', () => {
  it('HTML reads as styled runs with safe links only', () => {
    const spans = htmlSpans(
      '<p>Hi <strong>there</strong> &amp; <a href="https://bd.test">visit</a> <a href="javascript:alert(1)">bad</a></p><ul><li>one</li><li>two</li></ul>',
    )
    assert.equal(spansText(spans), 'Hi there & visit bad\n\n• one\n• two')
    const links = spans.filter((s) => s.link)
    assert.deepEqual(
      links.map((s) => [s.text, s.link]),
      [['visit', 'https://bd.test']],
    )
    assert.ok(spans.some((s) => s.bold && s.text === 'there'))
  })

  it('headings and quotes carry their style', () => {
    const spans = htmlSpans('<h2>Title</h2><blockquote>Said</blockquote>')
    assert.equal(spansText(spans), 'Title\n\nSaid')
    assert.equal(spans.find((s) => s.text === 'Title')?.heading, 2)
    assert.equal(spans.find((s) => s.text === 'Said')?.quote, true)
  })

  it('a stray angle bracket is text, not a hang', () => {
    assert.equal(spansText(htmlSpans('a < b')), 'a < b')
  })

  it('entities decode', () => {
    assert.equal(
      decodeEntities('&ldquo;Fish&rdquo; &amp; chips &mdash; 5 &gt; 3 &#169; &#x1F600;'),
      '“Fish” & chips — 5 > 3 © 😀',
    )
    assert.equal(decodeEntities('&unknown; &#xZZ;'), '&unknown; &#xZZ;')
  })

  it('only web, mail and phone links are safe', () => {
    assert.equal(safeLink(' mailto:a@b.co '), 'mailto:a@b.co')
    assert.equal(safeLink('tel:+15550100'), 'tel:+15550100')
    assert.equal(safeLink('javascript:alert(1)'), null)
    assert.equal(safeLink('intent://scan/#Intent;end'), null)
    assert.equal(safeLink('not a url'), null)
    assert.equal(safeHttpUrl('https://cdn.test/a.png'), 'https://cdn.test/a.png')
    assert.equal(safeHttpUrl('data:image/png;base64,AA'), null)
  })
})

describe('numbers typed as text', () => {
  it('keeps partial input and filters the rest', () => {
    assert.equal(sanitizeNumber('-12.5', true, true), '-12.5')
    assert.equal(sanitizeNumber('1a2,5.7', true, false), '12.57')
    assert.equal(sanitizeNumber('1-2.5', false, true), '125')
    assert.equal(sanitizeNumber('-12', true, false), '12')
    assert.equal(sanitizeNumber('040', true, true), '40')
    assert.equal(sanitizeNumber('-007', true, true), '-7')
    assert.equal(sanitizeNumber('0.5', true, true), '0.5')
    assert.equal(sanitizeNumber('00', true, true), '0')
    assert.equal(parseNumber('-'), null)
    assert.equal(parseNumber('-.'), null)
    assert.equal(parseNumber('1.'), 1)
    assert.equal(formatNumber(null), '')
    assert.equal(formatNumber(1.5), '1.5')
    assert.equal(formatNumber(3), '3')
  })
})

describe('phones, tables, colors, times', () => {
  it('formats US and international phone numbers as typed', () => {
    assert.equal(formatPhone('555', false), '555')
    assert.equal(formatPhone('5551234', false), '(555) 123-4')
    assert.equal(formatPhone('(555) 123-45678', false), '(555) 123-4567')
    assert.equal(formatPhone('+44 20712345', true), '+442 071 234 5')
  })

  it('reads check cells', () => {
    assert.equal(tableCheckState(' Yes '), 'yes')
    assert.equal(tableCheckState('—'), 'no')
    assert.equal(tableCheckState('Weekly'), 'text')
  })

  it('parses and normalizes hex colors', () => {
    assert.equal(normalizeHex('#369'), '#336699')
    assert.equal(normalizeHex('3b82f6'), '#3B82F6')
    assert.equal(normalizeHex('#12345'), null)
    assert.equal(contrastingText('#1E293B'), '#FFFFFF')
    assert.equal(contrastingText('#FACC15'), '#000000')
  })

  it('reads and writes days and times', () => {
    assert.equal(parseTime('09:05'), '09:05')
    assert.equal(parseTime('9:05'), '09:05')
    assert.equal(parseTime('23:59:30'), '23:59')
    assert.equal(parseTime('24:00'), null)
    assert.equal(parseTime('9'), null)
    assert.deepEqual(parseDay('2026-11-20T10:00:00Z'), { y: 2026, m: 11, d: 20 })
    assert.equal(parseDay('2026-02-30'), null)
    assert.equal(parseDay(''), null)
    assert.equal(formatTime('14:30', true), '2:30 PM')
    assert.equal(formatTime('00:15', true), '12:15 AM')
    assert.equal(timesOfDay(30).length, 48)
    assert.equal(timesOfDay(30)[19], '09:30')
  })

  it('formats file sizes', () => {
    assert.equal(formatBytes(512), '512 B')
    assert.equal(formatBytes(1536), '1.5 KB')
    assert.equal(formatBytes(12 * 1024 * 1024), '12 MB')
    assert.equal(formatBytes(undefined), null)
  })
})
