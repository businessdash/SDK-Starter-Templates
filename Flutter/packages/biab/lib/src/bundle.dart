/// Reads a value out of a schema-driven payload, with a fallback.
///
/// Two BIAB surfaces genuinely can't be fixed models, because the org defines
/// their shape in the dashboard: the **marketing bundle** (whatever
/// `biab.config.ts` declared) and **custom-database records**. Everything
/// else in this library is a real class — reaching for this on a typed
/// endpoint means the model is wrong, not that the endpoint is dynamic.
extension BiabBundle on Map<String, dynamic>? {
  /// Walk a key path: `bundle.path(['sections', 'hero', 'headline'])`.
  ///
  /// Returns null for a missing key AND for an empty string, because those
  /// mean the same thing to a screen: show the local fallback. An author who
  /// cleared a field wants the default back, not a blank heading.
  Object? path(List<String> keys) {
    Object? current = this;
    for (final key in keys) {
      if (current is! Map<String, dynamic>) return null;
      current = current[key];
    }
    if (current is String && current.isEmpty) return null;
    return current;
  }

  /// `bundle.string(['sections', 'hero', 'headline']) ?? 'A business, in a box.'`
  String? string(List<String> keys) {
    final value = path(keys);
    return value is String ? value : null;
  }

  List<dynamic>? list(List<String> keys) {
    final value = path(keys);
    return value is List ? value : null;
  }
}
