import Foundation

// Social links.
//
// The resolver is the same logic as the native Swift starter's — deliberately,
// because a server rendering a Leaf template and an app rendering SwiftUI must
// produce the same link from the same stored handle. The platform table under
// it is generated from sdk/src/socials.ts.

// MARK: - Social links

/// One resolved social profile: which platform, what to call it, and where it
/// points once the org's raw value has been turned into a real URL.
public struct SocialProfile: Sendable, Hashable, Identifiable {
    public let key: String
    public let label: String
    /// A simple-icons slug, or nil for platforms with no icon in that set.
    public let iconSlug: String?
    public let url: String

    public var id: String { key }
}

public enum Socials {
    /// Normalise one stored value into a real URL.
    ///
    /// Orgs type these by hand, so the same field arrives as
    /// `https://instagram.com/acme`, `acme`, `@acme` or `instagram.com/acme`.
    /// The rules, matching the JS SDK exactly:
    ///
    ///   - anything already absolute (`http`, `https`, `mailto:`, `tel:`) is
    ///     left alone — the org meant that link;
    ///   - a known platform prefixes its handle, dropping a leading `@`;
    ///   - anything else is assumed to be a bare domain and gets `https://`.
    public static func href(for value: String, platform: SocialPlatform) -> String {
        let v = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if let scheme = v.range(of: "^(https?://|mailto:|tel:)", options: [.regularExpression, .caseInsensitive]),
           scheme.lowerBound == v.startIndex {
            return v
        }
        if let prefix = platform.hrefPrefix {
            return prefix + (v.hasPrefix("@") ? String(v.dropFirst()) : v)
        }
        return "https://" + v.drop(while: { $0 == "/" })
    }

    /// Turn a company profile's `socials` map into a render-ready list.
    ///
    /// Returned in the platform table's canonical order rather than whatever
    /// order the keys happened to arrive in, so a site's social row does not
    /// reshuffle itself when the org edits an unrelated field. Empty values and
    /// unknown keys are dropped, and the first value wins if a platform somehow
    /// appears twice.
    public static func resolve(_ socials: [String: String]?) -> [SocialProfile] {
        guard let socials else { return [] }

        var present: [String: String] = [:]
        for (rawKey, rawValue) in socials {
            let value = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
            if value.isEmpty { continue }
            guard let platform = platform(forKey: rawKey) else { continue }
            if present[platform.key] != nil { continue }
            present[platform.key] = value
        }

        return SocialPlatforms.all.compactMap { platform in
            guard let value = present[platform.key] else { return nil }
            return SocialProfile(
                key: platform.key,
                label: platform.label,
                iconSlug: platform.iconSlug,
                url: href(for: value, platform: platform)
            )
        }
    }

    /// Case-insensitive lookup, because these keys come from stored JSON where
    /// `twitterX`, `twitterx` and `TWITTERX` are all plausible.
    public static func platform(forKey key: String) -> SocialPlatform? {
        let needle = key.lowercased()
        return SocialPlatforms.all.first { $0.key.lowercased() == needle }
    }
}

/// `[String: JSONValue]` is what a decoded bundle actually hands you; this
/// keeps the string-only `resolve` above usable without a manual conversion.
extension Socials {
    public static func resolve(_ socials: [String: JSONValue]?) -> [SocialProfile] {
        guard let socials else { return [] }
        var flat: [String: String] = [:]
        for (key, value) in socials {
            if case let .string(s) = value { flat[key] = s }
        }
        return resolve(flat)
    }
}
