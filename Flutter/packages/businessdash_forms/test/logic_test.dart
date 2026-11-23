// A port of the React Native renderer's `__tests__/logic.test.ts`: the
// same inputs, the same answers, so a form reads and writes identically on
// every platform.
import 'package:businessdash_forms/src/icons.dart';
import 'package:businessdash_forms/src/logic.dart';
import 'package:flutter_test/flutter_test.dart';

BdTextState at(String text, int start, [int? end]) => (text: text, start: start, end: end ?? start);

void main() {
  group("rich text: the editor's markup and the HTML BD keeps", () {
    test('paragraphs and inline formatting become BD HTML', () {
      expect(
        markupToHtml('Hello **bold** and *soft* and ~~gone~~\nSecond'),
        '<p>Hello <strong>bold</strong> and <em>soft</em> and <s>gone</s></p><p>Second</p>',
      );
    });

    test('lists group consecutive items', () {
      expect(
        markupToHtml('Intro\n• one\n- two\n1. first\n2. second'),
        '<p>Intro</p><ul><li>one</li><li>two</li></ul><ol><li>first</li><li>second</li></ol>',
      );
    });

    test("blank lines survive but trailing ones don't", () {
      expect(markupToHtml('a\n\nb\n\n'), '<p>a</p><p><br></p><p>b</p>');
      expect(markupToHtml('  \n '), '');
    });

    test('typed markup is escaped, not injected', () {
      expect(markupToHtml('<script>x</script> & 2*3*4'), '<p>&lt;script&gt;x&lt;/script&gt; &amp; 2*3*4</p>');
    });

    test('stored HTML round-trips through the editor', () {
      const html =
          '<p>Hello <strong>bold</strong> <em>soft</em></p><p><br></p><ul><li>one</li><li>two</li></ul><ol><li>a</li></ol>';
      final markup = htmlToMarkup(html);
      expect(markup, 'Hello **bold** *soft*\n\n• one\n• two\n1. a');
      expect(markupToHtml(markup), html);
    });

    test('wrap puts markers around the selection and takes them off', () {
      final wrapped = wrapSelection(at('make bold', 5, 9), '**');
      expect(wrapped, at('make **bold**', 7, 11));
      expect(wrapSelection(wrapped, '**').text, 'make bold');
      expect(wrapSelection(at('ab', 1), '*'), at('a**b', 2));
    });

    test('pressing a format button again turns it off', () {
      expect(wrapSelection(at('a ****', 4), '**'), at('a ', 2));
      expect(wrapSelection(at('make **bold**', 11), '**'), at('make **bold**', 13));
      expect(wrapSelection(at('**bold**', 6), '*').text, '**bold****');
      expect(wrapSelection(at('x **y**', 2), '**'), at('x ******y**', 4));
    });

    test('the list toggle adds, switches and removes the marker', () {
      final bullet = toggleListLine(at('one\ntwo', 5), false);
      expect(bullet.text, 'one\n• two');
      final numbered = toggleListLine(bullet, true);
      expect(numbered.text, 'one\n1. two');
      expect(toggleListLine(numbered, true).text, 'one\ntwo');
      expect(toggleListLine(at('1. a\nb', 6), true).text, '1. a\n2. b');
    });
  });

  group('reading richtext content', () {
    test('HTML reads as styled runs with safe links only', () {
      final spans = htmlSpans(
        '<p>Hi <strong>there</strong> &amp; <a href="https://bd.test">visit</a> '
        '<a href="javascript:alert(1)">bad</a></p><ul><li>one</li><li>two</li></ul>',
      );
      expect(spansText(spans), 'Hi there & visit bad\n\n• one\n• two');
      expect([for (final s in spans) if (s.link != null) (s.text, s.link)], [('visit', 'https://bd.test')]);
      expect(spans.any((s) => s.bold && s.text == 'there'), isTrue);
    });

    test('headings and quotes carry their style', () {
      final spans = htmlSpans('<h2>Title</h2><blockquote>Said</blockquote>');
      expect(spansText(spans), 'Title\n\nSaid');
      expect(spans.firstWhere((s) => s.text == 'Title').heading, 2);
      expect(spans.firstWhere((s) => s.text == 'Said').quote, isTrue);
    });

    test('a stray angle bracket is text, not a hang', () {
      expect(spansText(htmlSpans('a < b')), 'a < b');
    });

    test('entities decode', () {
      expect(
        decodeEntities('&ldquo;Fish&rdquo; &amp; chips &mdash; 5 &gt; 3 &#169; &#x1F600;'),
        '“Fish” & chips — 5 > 3 © 😀',
      );
      expect(decodeEntities('&unknown; &#xZZ;'), '&unknown; &#xZZ;');
    });

    test('only web, mail and phone links are safe', () {
      expect(safeLink(' mailto:a@b.co '), 'mailto:a@b.co');
      expect(safeLink('tel:+15550100'), 'tel:+15550100');
      expect(safeLink('javascript:alert(1)'), isNull);
      expect(safeLink('intent://scan/#Intent;end'), isNull);
      expect(safeLink('not a url'), isNull);
      expect(safeHttpUrl('https://cdn.test/a.png'), 'https://cdn.test/a.png');
      expect(safeHttpUrl('data:image/png;base64,AA'), isNull);
    });
  });

  group('numbers typed as text', () {
    test('keeps partial input and filters the rest', () {
      expect(sanitizeNumber('-12.5', true, true), '-12.5');
      expect(sanitizeNumber('1a2,5.7', true, false), '12.57');
      expect(sanitizeNumber('1-2.5', false, true), '125');
      expect(sanitizeNumber('-12', true, false), '12');
      expect(sanitizeNumber('040', true, true), '40');
      expect(sanitizeNumber('-007', true, true), '-7');
      expect(sanitizeNumber('0.5', true, true), '0.5');
      expect(sanitizeNumber('00', true, true), '0');
      expect(parseNumber('-'), isNull);
      expect(parseNumber('-.'), isNull);
      expect(parseNumber('1.'), 1);
      expect(parseNumber('.5'), 0.5);
      expect(parseNumber('-.5'), -0.5);
      expect(formatNumber(null), '');
      expect(formatNumber(1.5), '1.5');
      expect(formatNumber(3), '3');
    });
  });

  group('phones, tables, colors, times', () {
    test('formats US and international phone numbers as typed', () {
      expect(formatPhone('555', false), '555');
      expect(formatPhone('5551234', false), '(555) 123-4');
      expect(formatPhone('(555) 123-45678', false), '(555) 123-4567');
      expect(formatPhone('+44 20712345', true), '+442 071 234 5');
    });

    test('reads check cells', () {
      expect(tableCheckState(' Yes '), 'yes');
      expect(tableCheckState('—'), 'no');
      expect(tableCheckState('Weekly'), 'text');
    });

    test('parses and normalizes hex colors', () {
      expect(normalizeHex('#369'), '#336699');
      expect(normalizeHex('3b82f6'), '#3B82F6');
      expect(normalizeHex('#12345'), isNull);
      expect(contrastingText('#1E293B'), '#FFFFFF');
      expect(contrastingText('#FACC15'), '#000000');
      expect(hexToArgb('#369'), 0xFF336699);
    });

    test('reads and writes days and times', () {
      expect(parseTime('09:05'), '09:05');
      expect(parseTime('9:05'), '09:05');
      expect(parseTime('23:59:30'), '23:59');
      expect(parseTime('24:00'), isNull);
      expect(parseTime('9'), isNull);
      expect(parseDay('2026-11-20T10:00:00Z'), (y: 2026, m: 11, d: 20));
      expect(parseDay('2026-02-30'), isNull);
      expect(parseDay(''), isNull);
      expect(formatTime('14:30', true), '2:30 PM');
      expect(formatTime('00:15', true), '12:15 AM');
      expect(timesOfDay(30).length, 48);
      expect(timesOfDay(30)[19], '09:30');
      expect(weekday((y: 2026, m: 11, d: 22)), 0);
      expect(addDays((y: 2026, m: 12, d: 31), 1), (y: 2027, m: 1, d: 1));
    });

    test('formats file sizes', () {
      expect(formatBytes(512), '512 B');
      expect(formatBytes(1536), '1.5 KB');
      expect(formatBytes(12 * 1024 * 1024), '12 MB');
      expect(formatBytes(null), isNull);
    });
  });

  group('icons', () {
    test("Lucide's shapes parse into paths", () {
      final icon = BdSvg.parse(
        '<svg><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>'
        '<circle cx="9" cy="9" r="2"/><rect width="18" height="18" x="3" y="3" rx="2"/>'
        '<line x1="2" x2="22" y1="10" y2="10"/><polyline points="20 6 9 17 4 12"/>'
        '<circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>',
      );
      expect(icon.parts.length, 6);
      expect(icon.parts.last.filled, isTrue);
      final file = icon.parts.first.path.getBounds();
      expect(file.left, closeTo(4, 0.01));
      expect(file.top, closeTo(2, 0.01));
      expect(file.right, closeTo(20, 0.01));
      expect(file.bottom, closeTo(22, 0.01));
    });

    test('compact arc flags and implicit commands parse', () {
      // "a.5.5 0 011 1" packs the flags against the next number.
      final p = BdSvg.parsePath('M1 1a.5.5 0 011 1l2 0 0 2z');
      final b = p.getBounds();
      expect(b.left, closeTo(1, 0.01));
      expect(b.right, closeTo(4, 0.01));
      expect(b.bottom, closeTo(4, 0.01));
    });

    test('a broken path is dropped, not thrown', () {
      expect(BdSvg.parse('<path d="M1 1 Q"/><circle cx="1" cy="1" r="1"/>').parts.length, 1);
    });
  });
}
