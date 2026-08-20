import 'dart:convert';

/// One tag for a document `<head>`.
class HeadTag {
  const HeadTag(this.tag, this.attributes, {this.children});

  final String tag;
  final List<MapEntry<String, String>> attributes;

  /// Text content — the title string, or a JSON-LD payload.
  final String? children;
}

/// The org's per-page SEO, turned into head tags.
///
/// The marketing page bundle carries a `seo` object for the page you asked
/// for: title, description, canonical, `noIndex`, Open Graph, Twitter card,
/// keywords, JSON-LD and hreflang. Reading four of those and forgetting the
/// rest is the normal failure, and the two people forget are `noIndex` and
/// `canonicalUrl` — exactly the two where being wrong is expensive and silent.
///
/// A Flutter app mostly has no `<head>`. This matters anyway for Flutter Web,
/// for a `WebView` rendering org content, and for populating a share sheet,
/// where `ogTitle` and `ogImageUrl` are the whole payload.
///
/// Rules, matching the TypeScript `seo-core`:
///
///  * Open Graph falls back to the page's own title/description. A missing
///    `og:title` renders a shared link as a bare URL.
///  * A RELATIVE canonical is dropped rather than emitted: crawlers resolve it
///    against whatever URL they fetched, so on a parameterised URL it points
///    somewhere nobody intended. A missing canonical is recoverable; a wrong
///    one consolidates ranking onto the wrong page.
///  * `robots` is always emitted, both ways. Absence means "index", so relying
///    on absence to express noindex is catastrophic.
List<HeadTag> seoHeadTags(Map<String, dynamic>? seo, {String? baseUrl}) {
  if (seo == null) return const [];

  final title = _text(seo['seoTitle']);
  final description = _text(seo['seoDescription']);
  final canonical = _absolute(_text(seo['canonicalUrl']), baseUrl);
  final noIndex = seo['noIndex'] == true;

  final ogTitle = _text(seo['ogTitle']) ?? title;
  final ogDescription = _text(seo['ogDescription']) ?? description;
  final ogImage = _absolute(_text(seo['ogImageUrl']), baseUrl);

  final tags = <HeadTag>[];
  if (title != null) tags.add(HeadTag('title', const [], children: title));
  if (description != null) tags.add(_meta('name', 'description', description));

  final keywords = seo['keywords'];
  if (keywords is List && keywords.isNotEmpty) {
    final joined = keywords.whereType<String>().join(', ');
    if (joined.isNotEmpty) tags.add(_meta('name', 'keywords', joined));
  }
  tags.add(_meta('name', 'robots', noIndex ? 'noindex, nofollow' : 'index, follow'));

  if (ogTitle != null) tags.add(_meta('property', 'og:title', ogTitle));
  if (ogDescription != null) tags.add(_meta('property', 'og:description', ogDescription));
  if (ogImage != null) tags.add(_meta('property', 'og:image', ogImage));
  if (canonical != null) tags.add(_meta('property', 'og:url', canonical));
  tags.add(_meta('property', 'og:type', 'website'));

  tags.add(_meta('name', 'twitter:card', _text(seo['twitterCard']) ?? 'summary_large_image'));
  if (ogTitle != null) tags.add(_meta('name', 'twitter:title', ogTitle));
  if (ogDescription != null) tags.add(_meta('name', 'twitter:description', ogDescription));
  if (ogImage != null) tags.add(_meta('name', 'twitter:image', ogImage));

  if (canonical != null) {
    tags.add(HeadTag('link', [
      const MapEntry('rel', 'canonical'),
      MapEntry('href', canonical),
    ]));
  }
  final hreflang = seo['hreflang'];
  if (hreflang is Map) {
    for (final entry in hreflang.entries) {
      final href = _absolute(_text(entry.value), baseUrl);
      if (href == null) continue;
      tags.add(HeadTag('link', [
        const MapEntry('rel', 'alternate'),
        MapEntry('hreflang', '${entry.key}'),
        MapEntry('href', href),
      ]));
    }
  }
  final nodes = seo['jsonldNodes'];
  if (nodes is List) {
    for (final node in nodes) {
      tags.add(HeadTag(
        'script',
        [const MapEntry('type', 'application/ld+json')],
        children: jsonEncode(node),
      ));
    }
  }
  return tags;
}

/// Ready-to-inject HTML, for Flutter Web or a WebView.
String renderSeoHead(Map<String, dynamic>? seo, {String? baseUrl}) {
  return seoHeadTags(seo, baseUrl: baseUrl).map((tag) {
    final attrs =
        tag.attributes.map((a) => '${a.key}="${_escape(a.value)}"').join(' ');
    switch (tag.tag) {
      case 'title':
        return '<title>${_escape(tag.children ?? '')}</title>';
      case 'script':
        // `<` is what closes the script early; escaping the whole payload
        // would corrupt the JSON instead.
        final payload = (tag.children ?? '').replaceAll('<', r'\u003c');
        return '<script $attrs>$payload</script>';
      default:
        return '<${tag.tag} $attrs>';
    }
  }).join('\n');
}

HeadTag _meta(String key, String name, String content) =>
    HeadTag('meta', [MapEntry(key, name), MapEntry('content', content)]);

String? _text(dynamic value) {
  if (value is! String) return null;
  final trimmed = value.trim();
  return trimmed.isEmpty ? null : trimmed;
}

String? _absolute(String? url, String? baseUrl) {
  if (url == null) return null;
  if (RegExp(r'^([a-z][a-z0-9+.-]*:|//)', caseSensitive: false).hasMatch(url)) {
    return url;
  }
  // A relative canonical is worse than none — see the note above.
  if (baseUrl == null || baseUrl.trim().isEmpty) return null;
  final base = baseUrl.replaceAll(RegExp(r'/+$'), '');
  return url.startsWith('/') ? '$base$url' : '$base/$url';
}

String _escape(String value) => value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
