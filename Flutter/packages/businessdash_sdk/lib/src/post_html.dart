/// A blog post's HTML made safe, and the small things every post shows.
///
/// ## Why the post body is rebuilt, not trusted
///
/// A post's `content` is HTML written in the BusinessDash editor, and the
/// API returns it as it was saved. [PostHtml.safe] reads the HTML and writes
/// out only the tags and attributes on the lists below, with every value
/// escaped again; everything else becomes text. It is the web starters'
/// `safePostHtml` (`src/shop/blog.ts`) line for line, and
/// `test/fixtures/post-html-parity.json` holds the cases every starter's port
/// must answer the same way.
///
/// The app never shows this HTML as a web page: [PostBlocks] reads it into
/// native pieces. Cleaning it first means the reader only ever sees
/// well-nested, allowlisted tags.
class PostHtml {
  const PostHtml._();

  static const _allowedTags = {
    'a', 'abbr', 'b', 'blockquote', 'br', 'caption', 'code', 'del', 'div',
    'em', //
    'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i',
    'img', //
    'ins', 'kbd', 'li', 'mark', 'ol', 'p', 'pre', 's', 'small', 'span',
    'strong', //
    'sub', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u',
    'ul',
  };
  static const _voidTags = {'br', 'hr', 'img'};

  /// Tags whose whole content goes, not only the tag.
  static const _droppedWithContent = {
    'script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript',
    'textarea', 'select', //
  };
  static const _allowedAttributes = <String, Set<String>>{
    '*': {'title', 'id', 'class'},
    'a': {'href'},
    'img': {'src', 'alt', 'width', 'height', 'loading'},
    'td': {'colspan', 'rowspan'},
    'th': {'colspan', 'rowspan', 'scope'},
    'ol': {'start'},
  };
  static const _urlAttributes = {'href', 'src'};

  static final _tag =
      RegExp(r'''<\/?([a-zA-Z][a-zA-Z0-9]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>''');
  static final _attribute = RegExp(
      r'''([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?''');
  static final _bareAmpersand = RegExp(
      r'&(?![a-zA-Z][a-zA-Z0-9]{1,31};|#[0-9]{1,7};|#x[0-9a-fA-F]{1,6};)');

  /// Make a post's HTML safe (see the note at the top).
  static String safe(String html) {
    final out = StringBuffer();
    final open = <String>[];
    var i = 0;
    String? dropping;
    while (i < html.length) {
      final lt = html.indexOf('<', i);
      if (lt == -1) {
        if (dropping == null) out.write(_escapeText(html.substring(i)));
        break;
      }
      if (dropping == null) out.write(_escapeText(html.substring(i, lt)));
      if (html.startsWith('<!--', lt)) {
        final end = html.indexOf('-->', lt + 4);
        i = end == -1 ? html.length : end + 3;
        continue;
      }
      final match = _tag.matchAsPrefix(html, lt);
      if (match == null) {
        if (dropping == null) out.write('&lt;');
        i = lt + 1;
        continue;
      }
      i = match.end;
      final whole = match.group(0)!;
      final closing = whole.startsWith('</');
      final name = match.group(1)!.toLowerCase();
      if (dropping != null) {
        if (closing && name == dropping) dropping = null;
        continue;
      }
      if (_droppedWithContent.contains(name)) {
        if (!closing && !whole.endsWith('/>')) dropping = name;
        continue;
      }
      if (!_allowedTags.contains(name)) continue;
      if (closing) {
        final at = open.lastIndexOf(name);
        if (at == -1) continue;
        // Close anything left open inside it, so the nesting stays whole.
        while (open.length > at) {
          out.write('</${open.removeLast()}>');
        }
        continue;
      }
      final allowed = _allowedAttributes[name];
      final attributes = StringBuffer();
      var external = false;
      for (final attribute in _attribute.allMatches(match.group(2) ?? '')) {
        final key = attribute.group(1)!.toLowerCase();
        if (!_allowedAttributes['*']!.contains(key) &&
            !(allowed?.contains(key) ?? false)) {
          continue;
        }
        var value = attribute.group(2) ??
            attribute.group(3) ??
            attribute.group(4) ??
            '';
        if (_urlAttributes.contains(key)) {
          final url = _safeUrl(value);
          if (url == null) continue;
          value = url;
          if (key == 'href' &&
              RegExp(r'^https?:', caseSensitive: false).hasMatch(url)) {
            external = true;
          }
        }
        attributes.write(' $key="${_escapeAttribute(value)}"');
      }
      if (name == 'a' && external) {
        attributes.write(' target="_blank" rel="noopener noreferrer nofollow"');
      }
      if (name == 'img' &&
          !RegExp(r'\sloading=').hasMatch(attributes.toString())) {
        attributes.write(' loading="lazy"');
      }
      out.write('<$name$attributes>');
      if (!_voidTags.contains(name)) open.add(name);
    }
    while (open.isNotEmpty) {
      out.write('</${open.removeLast()}>');
    }
    return out.toString();
  }

  /// Minutes to read a post: its words at 230 a minute, at least one.
  static int readingMinutes(String? html) {
    final words = (html ?? '')
        .replaceAll(RegExp(r'<[^>]*>'), ' ')
        .trim()
        .split(RegExp(r'\s+'))
        .where((word) => word.isNotEmpty)
        .length;
    final minutes = (words / 230).round();
    return minutes < 1 ? 1 : minutes;
  }

  static const _months = [
    'January', 'February', 'March', 'April', 'May', 'June', //
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  /// "November 18, 2026" (in UTC), or "" without a date.
  static String date(String? iso) {
    if (iso == null || iso.isEmpty) return '';
    final parsed = DateTime.tryParse(iso)?.toUtc();
    if (parsed == null) return '';
    return '${_months[parsed.month - 1]} ${parsed.day}, ${parsed.year}';
  }

  static String _escapeText(String value) => value
      // An entity already in the text (&amp; &#8217;) stays one.
      .replaceAll(_bareAmpersand, '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');

  static String _escapeAttribute(String value) =>
      _escapeText(value).replaceAll('"', '&quot;');

  static String _fromCode(String digits, int radix) {
    final code = int.tryParse(digits, radix: radix) ?? 0;
    // Out of range or a lone surrogate: the replacement character.
    if (code <= 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
      return '�';
    }
    return String.fromCharCode(code);
  }

  static String _decodeEntities(String value) => value
      .replaceAllMapped(RegExp(r'&#x([0-9a-f]+);?', caseSensitive: false),
          (m) => _fromCode(m.group(1)!, 16))
      .replaceAllMapped(
          RegExp(r'&#([0-9]+);?'), (m) => _fromCode(m.group(1)!, 10))
      .replaceAll(RegExp(r'&colon;', caseSensitive: false), ':')
      .replaceAll(RegExp(r'&tab;', caseSensitive: false), '\t')
      .replaceAll(RegExp(r'&newline;', caseSensitive: false), '\n')
      .replaceAll(RegExp(r'&amp;', caseSensitive: false), '&');

  /// http(s), mailto, tel, a path on the website, or a #fragment.
  static String? _safeUrl(String raw) {
    // Browsers ignore control characters and whitespace inside a scheme
    // ("java\nscript:"), so they are removed before the check.
    final value =
        _decodeEntities(raw).replaceAll(RegExp('[\u0000- \u007f-\u009f]'), '');
    if (RegExp(r'^(https?:|mailto:|tel:)', caseSensitive: false)
        .hasMatch(value)) {
      return raw.trim();
    }
    if (RegExp(r'^[a-z][a-z0-9+.-]*:', caseSensitive: false).hasMatch(value)) {
      return null;
    }
    if (value.startsWith('//')) return null;
    return raw.trim();
  }
}
