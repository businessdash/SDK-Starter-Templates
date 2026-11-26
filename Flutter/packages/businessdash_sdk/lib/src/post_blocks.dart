import 'post_html.dart';

/// A post's body as native pieces — a heading, a paragraph, a list, a
/// photo… — for an app to draw with its own text and image widgets. The HTML
/// goes through [PostHtml.safe] first, so what is read here is well nested
/// and holds only the allowlisted tags, and nothing in a post ever runs.
///
/// Links keep web, mail and phone addresses only (a path on the website
/// means nothing in an app), and photos need a full http(s) address. The
/// Swift and React Native starters read posts the same way.
class PostBlocks {
  const PostBlocks._();

  /// A post's HTML as blocks.
  static List<PostBlock> from(String? html) {
    final reader = _Reader()..read(PostHtml.safe(html ?? ''));
    return reader.blocks;
  }
}

/// A stretch of text with its inline styles.
class PostRun {
  const PostRun(this.text,
      {this.bold = false,
      this.italic = false,
      this.code = false,
      this.strike = false,
      this.link});

  final String text;
  final bool bold;
  final bool italic;
  final bool code;
  final bool strike;

  /// http(s), mailto: or tel: only.
  final String? link;

  PostRun withText(String text) => PostRun(text,
      bold: bold, italic: italic, code: code, strike: strike, link: link);

  @override
  bool operator ==(Object other) =>
      other is PostRun &&
      other.text == text &&
      other.bold == bold &&
      other.italic == italic &&
      other.code == code &&
      other.strike == strike &&
      other.link == link;

  @override
  int get hashCode => Object.hash(text, bold, italic, code, strike, link);

  @override
  String toString() => 'PostRun($text)';
}

/// The text of runs, styles dropped.
String plainText(List<PostRun> runs) => runs.map((run) => run.text).join();

class PostListItem {
  const PostListItem(
      {required this.marker, required this.text, required this.depth});

  /// "1.", "•" or "◦"; empty for a line that continues the item above.
  final String marker;
  final List<PostRun> text;

  /// 0 for the outer list, 1 for a list inside it, …
  final int depth;
}

class PostTableRow {
  const PostTableRow({required this.cells, required this.isHeader});

  final List<List<PostRun>> cells;

  /// Every cell is a `<th>`, or the row is in `<thead>`.
  final bool isHeader;
}

sealed class PostBlock {
  const PostBlock();
}

class PostHeading extends PostBlock {
  const PostHeading(this.level, this.text);
  final int level;
  final List<PostRun> text;
}

class PostParagraph extends PostBlock {
  const PostParagraph(this.text);
  final List<PostRun> text;
}

class PostQuote extends PostBlock {
  const PostQuote(this.text);
  final List<PostRun> text;
}

class PostList extends PostBlock {
  const PostList(this.items);
  final List<PostListItem> items;
}

class PostCode extends PostBlock {
  const PostCode(this.text);
  final String text;

  @override
  bool operator ==(Object other) => other is PostCode && other.text == text;

  @override
  int get hashCode => text.hashCode;
}

class PostImage extends PostBlock {
  const PostImage(this.url, this.alt);
  final String url;
  final String alt;

  @override
  bool operator ==(Object other) =>
      other is PostImage && other.url == url && other.alt == alt;

  @override
  int get hashCode => Object.hash(url, alt);
}

/// A photo's caption (`<figcaption>`) or a table's (`<caption>`).
class PostCaption extends PostBlock {
  const PostCaption(this.text);
  final List<PostRun> text;
}

class PostTable extends PostBlock {
  const PostTable(this.rows);
  final List<PostTableRow> rows;
}

class PostRule extends PostBlock {
  const PostRule();

  @override
  bool operator ==(Object other) => other is PostRule;

  @override
  int get hashCode => 0;
}

final _tag = RegExp(r'<(\/?)([a-z0-9]+)((?:\s+[a-z-]+="[^"]*")*)\s*\/?>');
final _attribute = RegExp(r'([a-z-]+)="([^"]*)"');
final _space = RegExp(r'[\t\n\r\f ]+');
final _entity =
    RegExp(r'&(#[0-9]{1,7}|#x[0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});');
const _named = {
  'amp': '&', 'lt': '<', 'gt': '>', 'quot': '"', 'apos': "'", 'nbsp': ' ', //
  'lsquo': '‘', 'rsquo': '’', 'ldquo': '“', 'rdquo': '”', //
  'ndash': '–', 'mdash': '—', 'hellip': '…', 'middot': '·', //
  'bull': '•', 'copy': '©', 'reg': '®', 'trade': '™', //
  'times': '×', 'deg': '°', 'euro': '€', 'pound': '£',
};

class _ListState {
  _ListState({required this.ordered, required this.next});
  final bool ordered;
  int next;
}

class _Reader {
  final blocks = <PostBlock>[];

  // The text being gathered, and the inline styles open around it.
  var _inline = <PostRun>[];
  // Underline and highlight (<u>, <mark>) read as plain text.
  var _bold = 0;
  var _italic = 0;
  var _strike = 0;
  var _code = 0;
  final _links = <String?>[];
  // Where the text goes when it's finished.
  int? _heading;
  var _quoteDepth = 0;
  var _preDepth = 0;
  var _inCaption = false;
  final _lists = <_ListState>[];
  var _listItems = <PostListItem>[];

  /// One marker per open `<li>`; "" once its first line is out.
  var _items = <String>[];
  List<PostTableRow>? _tableRows;
  List<List<PostRun>>? _row;
  var _rowIsHeader = true;
  var _inHead = false;

  void read(String html) {
    var at = 0;
    for (final match in _tag.allMatches(html)) {
      if (match.start > at) _text(html.substring(at, match.start));
      at = match.end;
      final name = match.group(2)!;
      if (match.group(1) == '/') {
        _close(name);
      } else {
        _open(name, _attributes(match.group(3) ?? ''));
      }
    }
    if (at < html.length) _text(html.substring(at));
    _finishParagraph();
    _finishList();
  }

  /// A finished block. A list still being gathered goes out first, so a
  /// photo inside a list item lands between its lines, not before them.
  void _emit(PostBlock block) {
    if (_listItems.isNotEmpty) {
      blocks.add(PostList(_listItems));
      _listItems = [];
    }
    blocks.add(block);
  }

  void _open(String name, Map<String, String> attrs) {
    switch (name) {
      case 'p' || 'div':
        if (_items.isNotEmpty || _row != null) {
          _newLine();
        } else {
          _finishParagraph();
        }
      case 'h1' || 'h2' || 'h3' || 'h4' || 'h5' || 'h6':
        _finishParagraph();
        _heading = int.tryParse(name.substring(1)) ?? 2;
      case 'blockquote':
        _finishParagraph();
        _quoteDepth += 1;
      case 'pre':
        _finishParagraph();
        _preDepth += 1;
      case 'ul' || 'ol':
        // A list inside an item: the item's text so far is its first line.
        _finishParagraph();
        final start = int.tryParse(attrs['start'] ?? '');
        _lists.add(_ListState(
            ordered: name == 'ol',
            next: start == null || start == 0 ? 1 : start));
      case 'li':
        _finishParagraph();
        if (_lists.isEmpty) break;
        final list = _lists.last;
        if (list.ordered) {
          _items.add('${list.next}.');
          list.next += 1;
        } else {
          _items.add(_lists.length == 1 ? '•' : '◦');
        }
      case 'table':
        _finishParagraph();
        _tableRows = [];
      case 'thead':
        _inHead = true;
      case 'tr':
        _row = [];
        _rowIsHeader = true;
      case 'td' || 'th':
        _inline = [];
        if (name == 'td') _rowIsHeader = false;
      case 'caption' || 'figcaption':
        _finishParagraph();
        _inCaption = true;
      case 'img':
        _finishParagraph();
        final src = attrs['src'] ?? '';
        if (RegExp(r'^https?://', caseSensitive: false).hasMatch(src)) {
          _emit(PostImage(src, attrs['alt'] ?? ''));
        }
      case 'hr':
        _finishParagraph();
        _emit(const PostRule());
      case 'br':
        _newLine();
      case 'b' || 'strong':
        _bold += 1;
      case 'i' || 'em':
        _italic += 1;
      case 's' || 'del':
        _strike += 1;
      case 'code' || 'kbd':
        _code += 1;
      case 'a':
        _links.add(_linkUrl(attrs['href']));
      default:
        break; // abbr, span, small, sub, sup, tbody, tfoot, figure: no styling of their own.
    }
  }

  void _close(String name) {
    switch (name) {
      case 'p' || 'div':
        if (_items.isEmpty && _row == null) _finishParagraph();
      case 'h1' || 'h2' || 'h3' || 'h4' || 'h5' || 'h6':
        _finishParagraph();
        _heading = null;
      case 'blockquote':
        _finishParagraph();
        if (_quoteDepth > 0) _quoteDepth -= 1;
      case 'pre':
        final text = plainText(_inline);
        _inline = [];
        if (text.trim().isNotEmpty) {
          _emit(PostCode(text.replaceAll(RegExp(r'^\n+|\n+$'), '')));
        }
        if (_preDepth > 0) _preDepth -= 1;
      case 'li':
        _finishParagraph();
        if (_items.isNotEmpty) _items.removeLast();
      case 'ul' || 'ol':
        _finishParagraph();
        if (_lists.isNotEmpty) _lists.removeLast();
        if (_lists.isEmpty) _finishList();
      case 'td' || 'th':
        _row?.add(_trimmed(_inline));
        _inline = [];
      case 'tr':
        final row = _row;
        if (row != null && row.isNotEmpty) {
          _tableRows?.add(
              PostTableRow(cells: row, isHeader: _inHead || _rowIsHeader));
        }
        _row = null;
      case 'thead':
        _inHead = false;
      case 'table':
        final rows = _tableRows;
        if (rows != null && rows.isNotEmpty) _emit(PostTable(rows));
        _tableRows = null;
      case 'caption' || 'figcaption':
        _finishParagraph();
        _inCaption = false;
      case 'b' || 'strong':
        if (_bold > 0) _bold -= 1;
      case 'i' || 'em':
        if (_italic > 0) _italic -= 1;
      case 's' || 'del':
        if (_strike > 0) _strike -= 1;
      case 'code' || 'kbd':
        if (_code > 0) _code -= 1;
      case 'a':
        if (_links.isNotEmpty) _links.removeLast();
      default:
        break;
    }
  }

  void _text(String raw) {
    var value = decodeEntities(raw);
    if (_preDepth == 0) {
      value = value.replaceAll(_space, ' ');
      // Spaces collapse, as in a browser: none at the start of a line.
      final gathered = plainText(_inline);
      final last = gathered.isEmpty ? '' : gathered[gathered.length - 1];
      if (last == '' || last == ' ' || last == '\n') {
        value = value.replaceFirst(RegExp(r'^ +'), '');
      }
    }
    if (value.isEmpty) return;
    String? link;
    for (final url in _links.reversed) {
      if (url != null) {
        link = url;
        break;
      }
    }
    _inline.add(PostRun(
      value,
      bold: _bold > 0,
      italic: _italic > 0,
      code: _code > 0 && _preDepth == 0,
      strike: _strike > 0,
      link: link,
    ));
  }

  void _newLine() {
    final gathered = plainText(_inline);
    if (gathered.isNotEmpty && !gathered.endsWith('\n')) {
      _inline.add(const PostRun('\n'));
    }
  }

  /// Send the text gathered so far where it belongs: a list line, a
  /// caption, a heading, a quote or a paragraph.
  void _finishParagraph() {
    final text = _trimmed(_inline);
    _inline = [];
    if (plainText(text).isEmpty) return;
    if (_lists.isNotEmpty) {
      // In an item (or loose in the list): one line, marked the first time.
      final marker = _items.isEmpty ? '' : _items.last;
      _listItems.add(
          PostListItem(marker: marker, text: text, depth: _lists.length - 1));
      if (_items.isNotEmpty) _items[_items.length - 1] = '';
    } else if (_inCaption) {
      _emit(PostCaption(text));
    } else if (_heading != null) {
      _emit(PostHeading(_heading!, text));
    } else if (_quoteDepth > 0) {
      _emit(PostQuote(text));
    } else {
      _emit(PostParagraph(text));
    }
  }

  void _finishList() {
    _items = [];
    if (_listItems.isNotEmpty) blocks.add(PostList(_listItems));
    _listItems = [];
  }
}

/// Runs without spaces or line breaks at either end.
List<PostRun> _trimmed(List<PostRun> runs) {
  final out = [...runs];
  while (out.isNotEmpty) {
    final text = out.first.text.replaceFirst(RegExp(r'^[ \n]+'), '');
    if (text.isNotEmpty) {
      out[0] = out.first.withText(text);
      break;
    }
    out.removeAt(0);
  }
  while (out.isNotEmpty) {
    final text = out.last.text.replaceFirst(RegExp(r'[ \n]+$'), '');
    if (text.isNotEmpty) {
      out[out.length - 1] = out.last.withText(text);
      break;
    }
    out.removeLast();
  }
  return out;
}

/// Web, mail and phone links open from the app; a path or a #fragment of
/// the website would go nowhere, so its text stays plain.
String? _linkUrl(String? href) {
  if (href == null || href.isEmpty) return null;
  return RegExp(r'^(https?://|mailto:|tel:)', caseSensitive: false)
          .hasMatch(href)
      ? href
      : null;
}

Map<String, String> _attributes(String raw) => {
      for (final match in _attribute.allMatches(raw))
        match.group(1)!: decodeEntities(match.group(2)!),
    };

/// Character references: numeric ones, and the named ones posts use. An
/// unknown name stays as written.
String decodeEntities(String value) {
  if (!value.contains('&')) return value;
  return value.replaceAllMapped(_entity, (match) {
    final body = match.group(1)!;
    if (body.startsWith('#')) {
      final hex = body.length > 1 && (body[1] == 'x' || body[1] == 'X');
      final code = int.tryParse(hex ? body.substring(2) : body.substring(1),
              radix: hex ? 16 : 10) ??
          0;
      if (code <= 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
        return '�';
      }
      return String.fromCharCode(code);
    }
    return _named[body] ?? match.group(0)!;
  });
}
