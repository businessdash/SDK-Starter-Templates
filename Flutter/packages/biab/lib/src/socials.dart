import 'social_platforms.generated.dart';

/// One resolved social profile: which platform, what to call it, and where it
/// points once the org's raw value has been turned into a real URL.
class SocialProfile {
  const SocialProfile({
    required this.key,
    required this.label,
    required this.iconSlug,
    required this.url,
  });

  final String key;
  final String label;

  /// A simple-icons slug, or null for platforms with no icon in that set.
  final String? iconSlug;
  final String url;
}

final _absolute = RegExp(r'^(https?://|mailto:|tel:)', caseSensitive: false);

/// Resolve one stored value into a real URL.
///
/// Orgs type these by hand, so the same field arrives as
/// `https://instagram.com/acme`, `acme`, `@acme` or `instagram.com/acme`:
///
///  * anything already absolute (`http`, `https`, `mailto:`, `tel:`) is left
///    alone — the org meant that link;
///  * a known platform prefixes its handle, dropping a leading `@`;
///  * anything else is assumed to be a bare domain and gets `https://`.
String socialHref(String value, SocialPlatform platform) {
  final v = value.trim();
  if (_absolute.hasMatch(v)) return v;
  final prefix = platform.hrefPrefix;
  if (prefix != null) {
    return prefix + (v.startsWith('@') ? v.substring(1) : v);
  }
  return 'https://${v.replaceFirst(RegExp(r'^/+'), '')}';
}

/// Case-insensitive platform lookup — these keys come from stored JSON, where
/// `twitterX`, `twitterx` and `TWITTERX` are all plausible.
SocialPlatform? socialPlatformFor(String key) {
  final needle = key.toLowerCase();
  for (final platform in kSocialPlatforms) {
    if (platform.key.toLowerCase() == needle) return platform;
  }
  return null;
}

/// Turn a company profile's `socials` map into a render-ready list.
///
/// There is no endpoint for this — social handles arrive on the branding /
/// page bundle as a plain map, and every consumer has to do the same three
/// things with them: drop the empties, work out the real URL, and put them in
/// a stable order. Doing that in a widget build method is how an app ends up
/// launching `https://@acme` and reshuffling its social row whenever an
/// unrelated field is edited.
///
/// Returned in the platform table's canonical order. Empty values and unknown
/// keys are dropped; the first value wins if a platform somehow appears twice.
List<SocialProfile> resolveSocialProfiles(Map<String, dynamic>? socials) {
  if (socials == null) return const [];

  final present = <String, String>{};
  socials.forEach((rawKey, rawValue) {
    if (rawValue is! String) return;
    final value = rawValue.trim();
    if (value.isEmpty) return;
    final platform = socialPlatformFor(rawKey);
    if (platform == null || present.containsKey(platform.key)) return;
    present[platform.key] = value;
  });

  final out = <SocialProfile>[];
  for (final platform in kSocialPlatforms) {
    final value = present[platform.key];
    if (value == null) continue;
    out.add(SocialProfile(
      key: platform.key,
      label: platform.label,
      iconSlug: platform.iconSlug,
      url: socialHref(value, platform),
    ));
  }
  return out;
}
