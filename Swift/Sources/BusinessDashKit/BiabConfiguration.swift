import Foundation

/// Where an app gets its BIAB settings.
///
/// There is no `.env` in an app bundle. The idiomatic place is Info.plist,
/// populated from an `.xcconfig` so the values aren't hard-coded in a file
/// people commit. `BiabStarter.xcconfig` in this starter shows the shape.
///
/// Only the publishable token belongs here. A secret `sk_…` in Info.plist is
/// a secret in the App Store — `BiabClient.init` traps if you try.
public struct BiabConfiguration: Sendable {
    public let host: URL
    public let publishableKey: String
    public let siteID: String
    public let authCallbackURL: String?

    public init(host: URL, publishableKey: String, siteID: String, authCallbackURL: String? = nil) {
        self.host = host
        self.publishableKey = publishableKey
        self.siteID = siteID
        self.authCallbackURL = authCallbackURL
    }

    /// Reads `BIABHost`, `BIABPublishableKey`, `BIABSiteID`, and optionally
    /// `BIABAuthCallbackURL` from the main bundle.
    ///
    /// Returns `nil` when they're absent, which is a supported state: the
    /// starter renders local fallback content and shows a setup notice rather
    /// than crashing on launch. A starter you can't run before signing up
    /// isn't a starter.
    public static func fromInfoPlist(bundle: Bundle = .main) -> BiabConfiguration? {
        func string(_ key: String) -> String? {
            (bundle.object(forInfoDictionaryKey: key) as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .nilIfEmpty
        }

        // Host has a sensible default; the key and site id do not — without
        // those there is nothing to talk to.
        let hostString = string("BIABHost") ?? "https://www.biab.app"

        guard
            let host = URL(string: hostString),
            let key = string("BIABPublishableKey"),
            let siteID = string("BIABSiteID")
        else { return nil }

        return BiabConfiguration(
            host: host,
            publishableKey: key,
            siteID: siteID,
            authCallbackURL: string("BIABAuthCallbackURL")
        )
    }

    public var client: BiabClient {
        BiabClient(host: host, publishableKey: publishableKey, siteID: siteID)
    }
}
