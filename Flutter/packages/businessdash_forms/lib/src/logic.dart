/// The renderer's pure logic: no widgets. What the controls write, and how
/// stored HTML reads back. The same reading as the Swift, Compose and React
/// Native renderers (this is a port of the RN `logic.ts`, with its tests),
/// so a form behaves the same on every platform.
library;

import 'dart:math' as math;

// ── HTML → styled runs ───────────────────────────────────────────────────

/// One run of text with the styles the BD HTML dialect can give it.
class BdSpan {
  const BdSpan(
    this.text, {
    this.bold = false,
    this.italic = false,
    this.underline = false,
    this.strike = false,
    this.code = false,
    this.heading,
    this.quote = false,
    this.link,
  });

  final String text;
  final bool bold;
  final bool italic;
  final bool underline;
  final bool strike;
  final bool code;

  /// 1–6 for headings.
  final int? heading;
  final bool quote;

  /// A link the visitor can safely open (web, mail, phone).
  final String? link;

  BdSpan withText(String text) => BdSpan(
        text,
        bold: bold,
        italic: italic,
        underline: underline,
        strike: strike,
        code: code,
        heading: heading,
        quote: quote,
        link: link,
      );
}

const _named = {
  'amp': '&',
  'lt': '<',
  'gt': '>',
  'quot': '"',
  'apos': "'",
  'nbsp': '\u00A0',
  'mdash': '—',
  'ndash': '–',
  'hellip': '…',
  'rsquo': '’',
  'lsquo': '‘',
  'rdquo': '”',
  'ldquo': '“',
  'copy': '©',
  'reg': '®',
  'trade': '™',
  'bull': '•',
};

String? _codePoint(int? cp) =>
    cp == null || cp < 0 || cp > 0x10FFFF ? null : String.fromCharCode(cp);

final _hexEntity = RegExp(r'^#[xX][0-9a-fA-F]+$');
final _decEntity = RegExp(r'^#\d+$');

String decodeEntities(String s) {
  if (!s.contains('&')) return s;
  final out = StringBuffer();
  var i = 0;
  while (i < s.length) {
    if (s[i] == '&') {
      final semi = s.indexOf(';', i);
      if (semi > i && semi <= i + 12) {
        final name = s.substring(i + 1, semi);
        String? rep;
        if (_hexEntity.hasMatch(name)) {
          rep = _codePoint(int.tryParse(name.substring(2), radix: 16));
        } else if (_decEntity.hasMatch(name)) {
          rep = _codePoint(int.tryParse(name.substring(1)));
        } else {
          rep = _named[name];
        }
        if (rep != null) {
          out.write(rep);
          i = semi + 1;
          continue;
        }
      }
    }
    out.write(s[i]);
    i++;
  }
  return out.toString();
}

String escapeHtml(String s) => s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

final _scheme = RegExp(r'^([a-z][a-z0-9+.-]*):', caseSensitive: false);

/// Only links a visitor can safely open: web, mail and phone.
String? safeLink(String? raw) {
  final s = (raw ?? '').trim();
  final m = _scheme.firstMatch(s);
  if (m == null) return null;
  final scheme = m[1]!.toLowerCase();
  return scheme == 'http' ||
          scheme == 'https' ||
          scheme == 'mailto' ||
          scheme == 'tel'
      ? s
      : null;
}

final _httpUrl = RegExp(r'^https?:\/\/[^\s]+$', caseSensitive: false);

/// Only http(s) links leave the form (images, "View" links).
String? safeHttpUrl(String? raw) {
  final s = (raw ?? '').trim();
  return _httpUrl.hasMatch(s) ? s : null;
}

String? _attribute(String name, String tag) {
  final m = RegExp('$name\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))',
          caseSensitive: false)
      .firstMatch(tag);
  if (m == null) return null;
  final v = m[2] ?? m[3] ?? m[4];
  return v == null ? null : decodeEntities(v);
}

final _tagName = RegExp('^[a-zA-Z0-9]*');
final _spaces = RegExp(r'\s+');
final _leadingSpaces = RegExp('^ +');
final _trailingNewlines = RegExp(r'\n+$');

class _ListLevel {
  _ListLevel(this.ordered);

  final bool ordered;
  var n = 0;
}

/// Server-sanitized `richtext` HTML as styled runs. Block elements become
/// line breaks (never more than one blank line in a row), lists become
/// "• " / "1. " lines, and only safe links survive.
List<BdSpan> htmlSpans(String html) {
  final spans = <BdSpan>[];
  final plain = StringBuffer();
  var bold = 0, italic = 0, underline = 0, strike = 0, code = 0, quote = 0;
  int? heading;
  final links = <String?>[];
  final lists = <_ListLevel>[];
  var pendingBreak = false;
  var atLineStart = true;

  bool plainEndsWith(String s) => plain.toString().endsWith(s);

  void raw(String s) {
    spans.add(BdSpan(s));
    plain.write(s);
  }

  void newline([int count = 1]) {
    if (plain.isEmpty) return;
    final have = plainEndsWith('\n\n') ? 2 : (plainEndsWith('\n') ? 1 : 0);
    if (count > have) raw('\n' * (count - have));
    atLineStart = true;
  }

  void emit(String text) {
    final t = atLineStart ? text.replaceFirst(_leadingSpaces, '') : text;
    if (t.isEmpty) return;
    if (pendingBreak) {
      newline(2);
      pendingBreak = false;
    }
    spans.add(
      BdSpan(
        t,
        bold: bold > 0 || heading != null,
        italic: italic > 0 || quote > 0,
        underline: underline > 0,
        strike: strike > 0,
        code: code > 0,
        heading: heading,
        quote: quote > 0,
        link: links.isEmpty ? null : links.last,
      ),
    );
    plain.write(t);
    atLineStart = false;
  }

  int dec(int n) => math.max(0, n - 1);

  var i = 0;
  while (i < html.length) {
    if (html[i] == '<') {
      final close = html.indexOf('>', i);
      if (close >= 0) {
        final tag = html.substring(i + 1, close);
        i = close + 1;
        if (tag.startsWith('!')) continue;
        final isEnd = tag.startsWith('/');
        final body = isEnd ? tag.substring(1) : tag;
        final name = (_tagName.firstMatch(body)?[0] ?? '').toLowerCase();
        switch (name) {
          case 'b' || 'strong':
            bold = isEnd ? dec(bold) : bold + 1;
          case 'i' || 'em':
            italic = isEnd ? dec(italic) : italic + 1;
          case 'u':
            underline = isEnd ? dec(underline) : underline + 1;
          case 's' || 'strike' || 'del':
            strike = isEnd ? dec(strike) : strike + 1;
          case 'code':
            code = isEnd ? dec(code) : code + 1;
          case 'a':
            if (isEnd) {
              if (links.isNotEmpty) links.removeLast();
            } else {
              links.add(safeLink(_attribute('href', body)));
            }
          case 'br':
            newline();
            pendingBreak = false;
          case 'p' || 'div' || 'pre':
            if (isEnd || plain.isNotEmpty) pendingBreak = true;
          case 'h1' || 'h2' || 'h3' || 'h4' || 'h5' || 'h6':
            if (isEnd) {
              heading = null;
              pendingBreak = true;
            } else {
              if (plain.isNotEmpty) pendingBreak = true;
              heading = int.parse(name.substring(1));
            }
          case 'blockquote':
            if (isEnd) {
              quote = dec(quote);
              pendingBreak = true;
            } else {
              if (plain.isNotEmpty) pendingBreak = true;
              quote++;
            }
          case 'ul' || 'ol':
            if (isEnd) {
              if (lists.isNotEmpty) lists.removeLast();
              if (lists.isEmpty) pendingBreak = true;
            } else {
              if (lists.isEmpty && plain.isNotEmpty) pendingBreak = true;
              lists.add(_ListLevel(name == 'ol'));
            }
          case 'li':
            if (!isEnd) {
              if (pendingBreak) {
                newline(2);
                pendingBreak = false;
              } else {
                newline();
              }
              final depth = math.max(lists.length - 1, 0);
              var marker = '•';
              if (lists.isNotEmpty) {
                final top = lists.last;
                top.n++;
                if (top.ordered) marker = '${top.n}.';
              }
              raw('${'    ' * depth}$marker ');
              atLineStart = true;
            }
        }
        continue;
      }
    }
    // Text up to the next tag. A stray "<" with no ">" after it is text.
    var next = html.indexOf('<', html[i] == '<' ? i + 1 : i);
    if (next < 0) next = html.length;
    emit(decodeEntities(html.substring(i, next)).replaceAll(_spaces, ' '));
    i = next;
  }

  // Drop trailing line breaks.
  while (spans.isNotEmpty) {
    final last = spans.last;
    final trimmed = last.text.replaceFirst(_trailingNewlines, '');
    if (trimmed.length == last.text.length) break;
    if (trimmed.isEmpty) {
      spans.removeLast();
    } else {
      spans[spans.length - 1] = last.withText(trimmed);
      break;
    }
  }
  return spans;
}

/// The runs' text, joined.
String spansText(List<BdSpan> spans) => spans.map((s) => s.text).join();

// ── Rich text editor: light markup ↔ the HTML BD keeps ───────────────────

/// Text plus selection, as a text field reports them.
typedef BdTextState = ({String text, int start, int end});

final _numbered = RegExp(r'^(\d+)\. ');
const _bullets = ['• ', '- ', '* '];
// No lookbehind: the content starts and ends with a non-space.
final _bold = RegExp(r'\*\*(\S(?:.*?\S)?)\*\*');
final _italic = RegExp(r'(^|[^*\w])\*([^\s*](?:.*?[^\s*])?)\*(?![*\w])');
final _strike = RegExp(r'~~(\S(?:.*?\S)?)~~');

String _inline(String text) => escapeHtml(text)
    .replaceAllMapped(_bold, (m) => '<strong>${m[1]}</strong>')
    .replaceAllMapped(_italic, (m) => '${m[1]}<em>${m[2]}</em>')
    .replaceAllMapped(_strike, (m) => '<s>${m[1]}</s>');

String? _bulletOf(String line) {
  for (final b in _bullets) {
    if (line.startsWith(b)) return b;
  }
  return null;
}

/// One line is one paragraph; `• `, `- ` or `* ` starts a bullet, `1. ` a
/// numbered item; `**bold**`, `*italic*`, `~~struck~~` inline.
String markupToHtml(String markup) {
  if (markup.trim().isEmpty) return '';
  final blocks = <String>[];
  String? open;
  void closeList() {
    if (open != null) blocks.add('</$open>');
    open = null;
  }

  for (final line in markup.split('\n')) {
    final bullet = _bulletOf(line);
    final number = _numbered.firstMatch(line);
    var kind = 'p';
    var body = line;
    if (bullet != null) {
      kind = 'ul';
      body = line.substring(bullet.length);
    } else if (number != null) {
      kind = 'ol';
      body = line.substring(number[0]!.length);
    }
    final inner = _inline(body);
    if (kind == 'p') {
      closeList();
      blocks.add(inner.isEmpty ? '<p><br></p>' : '<p>$inner</p>');
    } else {
      if (open != kind) {
        closeList();
        blocks.add('<$kind>');
        open = kind;
      }
      blocks.add('<li>$inner</li>');
    }
  }
  closeList();
  while (blocks.isNotEmpty && blocks.last == '<p><br></p>') {
    blocks.removeLast();
  }
  return blocks.join();
}

/// Stored HTML as editable markup (to restore a draft or default).
String htmlToMarkup(String html) {
  if (html.trim().isEmpty) return '';
  final out = StringBuffer();
  final lists = <_ListLevel>[];
  void lineBreak() {
    if (out.isNotEmpty && !out.toString().endsWith('\n')) out.write('\n');
  }

  var i = 0;
  while (i < html.length) {
    if (html[i] == '<') {
      final close = html.indexOf('>', i);
      if (close >= 0) {
        final tag = html.substring(i + 1, close);
        i = close + 1;
        final isEnd = tag.startsWith('/');
        final name =
            (_tagName.firstMatch(isEnd ? tag.substring(1) : tag)?[0] ?? '')
                .toLowerCase();
        switch (name) {
          case 'strong' || 'b':
            out.write('**');
          case 'em' || 'i':
            out.write('*');
          case 's' || 'strike' || 'del':
            out.write('~~');
          case 'br':
            out.write('\n');
          case 'p' ||
                'div' ||
                'pre' ||
                'blockquote' ||
                'h1' ||
                'h2' ||
                'h3' ||
                'h4' ||
                'h5' ||
                'h6':
            lineBreak();
          case 'ul' || 'ol':
            lineBreak();
            if (isEnd) {
              if (lists.isNotEmpty) lists.removeLast();
            } else {
              lists.add(_ListLevel(name == 'ol'));
            }
          case 'li':
            lineBreak();
            if (!isEnd) {
              final top = lists.isEmpty ? null : lists.last;
              if (top != null && top.ordered) {
                top.n++;
                out.write('${top.n}. ');
              } else {
                out.write('• ');
              }
            }
        }
        continue;
      }
    }
    var next = html.indexOf('<', html[i] == '<' ? i + 1 : i);
    if (next < 0) next = html.length;
    var text = decodeEntities(html.substring(i, next)).replaceAll(_spaces, ' ');
    if (out.isEmpty || out.toString().endsWith('\n')) {
      text = text.replaceFirst(_leadingSpaces, '');
    }
    out.write(text);
    i = next;
  }
  return out.toString().replaceAll(RegExp(r'^\n+|\n+$'), '');
}

/// How many `c` in a row start at `at` (or end there, going back).
int _runOf(String text, int at, String c, bool forward) {
  var n = 0;
  if (forward) {
    while (at + n < text.length && text[at + n] == c) {
      n++;
    }
  } else {
    while (at - n - 1 >= 0 && text[at - n - 1] == c) {
      n++;
    }
  }
  return n;
}

/// Whether the caret's line has an unclosed `m`-long run of `c` before `at`.
bool _openBefore(String text, int at, String c, int m) {
  var i = at == 0 ? 0 : text.lastIndexOf('\n', at - 1) + 1;
  var markers = 0;
  while (i < at) {
    if (text[i] != c) {
      i++;
      continue;
    }
    var n = 0;
    while (i + n < at && text[i + n] == c) {
      n++;
    }
    if (n == m) markers++;
    i += n;
  }
  return markers.isOdd;
}

/// Wrap the selection in `marker` (or unwrap it), or drop a pair at the caret.
BdTextState wrapSelection(BdTextState v, String marker) {
  final s = math.min(v.start, v.end);
  final e = math.max(v.start, v.end);
  final text = v.text;
  final m = marker.length;
  if (s == e) {
    final c = marker[0];
    final before = _runOf(text, s, c, false);
    final after = _runOf(text, s, c, true);
    // Pressed again before typing anything: take the empty pair back out.
    if (before == m && after == m) {
      return (
        text: text.substring(0, s - m) + text.substring(s + m),
        start: s - m,
        end: s - m
      );
    }
    // Pressed again at the end of a formatted run: step past the closing
    // marker, so what's typed next is plain.
    if (after == m && _openBefore(text, s, c, m)) {
      return (text: text, start: s + m, end: s + m);
    }
    return (
      text: text.substring(0, s) + marker + marker + text.substring(s),
      start: s + m,
      end: s + m
    );
  }
  if (s >= m && text.startsWith(marker, s - m) && text.startsWith(marker, e)) {
    return (
      text: text.substring(0, s - m) +
          text.substring(s, e) +
          text.substring(e + m),
      start: s - m,
      end: e - m,
    );
  }
  return (
    text: text.substring(0, s) +
        marker +
        text.substring(s, e) +
        marker +
        text.substring(e),
    start: s + m,
    end: e + m,
  );
}

/// Make the caret's line a list item, switch its kind, or make it a
/// paragraph again.
BdTextState toggleListLine(BdTextState v, bool ordered) {
  var text = v.text;
  final point = math.min(v.start, v.end);
  final start = point == 0 ? 0 : text.lastIndexOf('\n', point - 1) + 1;
  final line = text.substring(start).split('\n').first;
  final bulletLen = _bulletOf(line)?.length ?? 0;
  final numberLen = _numbered.firstMatch(line)?[0]!.length ?? 0;
  final existing = bulletLen > 0 ? bulletLen : numberLen;
  var shift = 0;
  if (existing > 0) {
    text = text.substring(0, start) + text.substring(start + existing);
    shift -= existing;
    if ((numberLen > 0) == ordered) {
      return (
        text: text,
        start: math.max(v.start + shift, start),
        end: math.max(v.end + shift, start)
      );
    }
  }
  var marker = '• ';
  if (ordered) {
    // Continue the numbering of the line above.
    var n = 1;
    if (start > 0) {
      final prevEnd = start - 1;
      final prevStart =
          prevEnd == 0 ? 0 : text.lastIndexOf('\n', prevEnd - 1) + 1;
      final prev = _numbered.firstMatch(text.substring(prevStart, prevEnd));
      if (prev != null) n = int.parse(prev[1]!) + 1;
    }
    marker = '$n. ';
  }
  text = text.substring(0, start) + marker + text.substring(start);
  shift += marker.length;
  final floor = start + marker.length;
  return (
    text: text,
    start: math.max(v.start + shift, floor),
    end: math.max(v.end + shift, floor)
  );
}

// ── Numbers typed as text ────────────────────────────────────────────────

final _digit = RegExp(r'\d');

/// Keep what the field allows; a comma is a decimal point; "040" is "40".
String sanitizeNumber(String s, bool allowDecimal, bool allowNegative) {
  var out = '';
  var sawDot = false;
  for (var i = 0; i < s.length; i++) {
    final c = s[i];
    if (c.compareTo('0') >= 0 && c.compareTo('9') <= 0 && c.length == 1) {
      out += c;
    } else if ((c == '.' || c == ',') && allowDecimal && !sawDot) {
      out += '.';
      sawDot = true;
    } else if (c == '-' && allowNegative && i == 0) {
      out += c;
    }
  }
  final start = out.startsWith('-') ? 1 : 0;
  while (out.length > start + 1 &&
      out[start] == '0' &&
      _digit.hasMatch(out[start + 1])) {
    out = out.substring(0, start) + out.substring(start + 1);
  }
  return out;
}

double? parseNumber(String s) {
  if (s == '' || s == '-' || s == '.' || s == '-.') return null;
  final text = s.endsWith('.')
      ? '${s}0'
      : (s.startsWith('.') || s.startsWith('-.')
          ? s.replaceFirst('.', '0.')
          : s);
  final n = double.tryParse(text);
  return n != null && n.isFinite ? n : null;
}

/// A number as JS `String(n)` writes it ("3", not "3.0"); "" for none.
String formatNumber(double? v) {
  if (v == null || !v.isFinite) return '';
  if (v == 0) return '0';
  final s = v.toString();
  return s.endsWith('.0') ? s.substring(0, s.length - 2) : s;
}

// ── Phone, tables, colors ────────────────────────────────────────────────

String formatPhone(String input, bool international) {
  final digits = input.replaceAll(RegExp(r'\D'), '');
  if (international) {
    final plus = input.trimLeft().startsWith('+') ? '+' : '';
    final d = digits.length > 15 ? digits.substring(0, 15) : digits;
    return '$plus${d.replaceAllMapped(RegExp(r'(\d{3})(?=\d)'), (m) => '${m[1]} ')}'
        .trim();
  }
  final d = digits;
  if (d.length <= 3) return d;
  if (d.length <= 6) return '(${d.substring(0, 3)}) ${d.substring(3)}';
  return '(${d.substring(0, 3)}) ${d.substring(3, 6)}-${d.substring(6, math.min(10, d.length))}';
}

/// A table cell in a `check` column: ✓, –, or its own text.
String tableCheckState(String cell) {
  final v = cell.trim().toLowerCase();
  if (const ['yes', 'y', 'true', '1', 'x', '✓', '✔', 'check'].contains(v)) {
    return 'yes';
  }
  if (const ['no', 'n', 'false', '0', '-', '–', '—', ''].contains(v)) {
    return 'no';
  }
  return 'text';
}

final _hex6 = RegExp(r'^[0-9a-fA-F]{6}$');

/// `#RRGGBB`, uppercase, as BD stores colors; null when it isn't a hex color.
String? normalizeHex(String hex) {
  var s = hex.trim().replaceFirst(RegExp('^#'), '');
  if (s.length == 3) s = s.split('').map((c) => '$c$c').join();
  if (!_hex6.hasMatch(s)) return null;
  return '#${s.toUpperCase()}';
}

/// The color a `#RRGGBB` string names, as ARGB.
int? hexToArgb(String hex) {
  final n = normalizeHex(hex);
  return n == null ? null : 0xFF000000 | int.parse(n.substring(1), radix: 16);
}

/// Black or white, whichever reads on `hex`.
String contrastingText(String? hex) {
  final n = hex == null ? null : normalizeHex(hex);
  if (n == null) return '#000000';
  final v = int.parse(n.substring(1), radix: 16);
  double lin(int c) {
    final s = c / 255;
    return s <= 0.03928
        ? s / 12.92
        : math.pow((s + 0.055) / 1.055, 2.4).toDouble();
  }

  final l = 0.2126 * lin((v >> 16) & 255) +
      0.7152 * lin((v >> 8) & 255) +
      0.0722 * lin(v & 255);
  return l > 0.45 ? '#000000' : '#FFFFFF';
}

// ── Dates and times ──────────────────────────────────────────────────────

/// A calendar day, with no time zone. Month is 1–12.
typedef BdDay = ({int y, int m, int d});

final _dayPrefix = RegExp(r'^(\d{4})-(\d{2})-(\d{2})');

/// The day at the start of an ISO date or date-time, or null.
BdDay? parseDay(String? s) {
  final m = _dayPrefix.firstMatch(s ?? '');
  if (m == null) return null;
  final y = int.parse(m[1]!);
  final mo = int.parse(m[2]!);
  final d = int.parse(m[3]!);
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null;
  return (y: y, m: mo, d: d);
}

String formatDay(BdDay day) =>
    '${day.y.toString().padLeft(4, '0')}-${day.m.toString().padLeft(2, '0')}-${day.d.toString().padLeft(2, '0')}';

int daysInMonth(int y, int m) => DateTime.utc(y, m + 1, 0).day;

int compareDays(BdDay a, BdDay b) =>
    a.y != b.y ? a.y - b.y : (a.m != b.m ? a.m - b.m : a.d - b.d);

BdDay today() {
  final n = DateTime.now();
  return (y: n.year, m: n.month, d: n.day);
}

BdDay dayOf(DateTime t) => (y: t.year, m: t.month, d: t.day);

DateTime dateOf(BdDay day) => DateTime(day.y, day.m, day.d);

BdDay addDays(BdDay day, int n) {
  final t = DateTime.utc(day.y, day.m, day.d + n);
  return (y: t.year, m: t.month, d: t.day);
}

/// 0 = Sunday.
int weekday(BdDay day) => DateTime.utc(day.y, day.m, day.d).weekday % 7;

final _timePrefix = RegExp(r'^(\d{1,2}):(\d{2})');

/// `HH:MM` from a stored time ("9:05" or "09:05:30" read too), or null.
String? parseTime(String? s) {
  final m = _timePrefix.firstMatch(s ?? '');
  if (m == null) return null;
  final h = int.parse(m[1]!);
  final min = int.parse(m[2]!);
  if (h > 23 || min > 59) return null;
  return '${h.toString().padLeft(2, '0')}:${min.toString().padLeft(2, '0')}';
}

/// "14:30" as "2:30 PM", or as is in 24-hour format.
String formatTime(String hhmm, bool twelveHour) {
  if (!twelveHour) return hhmm;
  final parts = hhmm.split(':');
  final h = int.tryParse(parts[0]) ?? 0;
  final ms = parts.length > 1 ? parts[1] : '00';
  return '${h % 12 == 0 ? 12 : h % 12}:$ms ${h < 12 ? 'AM' : 'PM'}';
}

/// Every time of day, `step` minutes apart, as `HH:MM`.
List<String> timesOfDay(int step) {
  final s = math.max(step <= 0 ? 30 : step, 1);
  return [
    for (var t = 0; t < 24 * 60; t += s)
      '${(t ~/ 60).toString().padLeft(2, '0')}:${(t % 60).toString().padLeft(2, '0')}',
  ];
}

/// "1.5 MB" style sizes.
String? formatBytes(num? n) {
  if (n == null || !n.isFinite || n < 0) return null;
  if (n < 1024) return '${n.toInt()} B';
  const units = ['KB', 'MB', 'GB'];
  var v = n / 1024;
  var u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  final shown = v >= 10 ? v.round().toDouble() : (v * 10).round() / 10;
  return '${formatNumber(shown)} ${units[u]}';
}

/// Toggle `item` in a list of strings.
List<String> toggled(List<String> list, String item) => list.contains(item)
    ? [
        for (final x in list)
          if (x != item) x
      ]
    : [...list, item];
