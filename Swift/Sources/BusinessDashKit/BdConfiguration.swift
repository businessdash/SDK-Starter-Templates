import Foundation

/// Where an app gets its BD settings.
///
/// There is no `.env` in an app bundle. The idiomatic place is Info.plist,
/// populated from an `.xcconfig` so the values aren't hard-coded in a file
/// people commit. `BdStarter.xcconfig` in this starter shows the shape.
///
/// Only the publishable token belongs here. A secret `sk_…` in Info.plist is
/// a secret in the App Store — `BdClient.init` traps if you try.
public struct BdConfiguration: Sendable {
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

    /// Reads `BDHost`, `BDPublishableKey`, `BDSiteID`, and optionally
    /// `BDAuthCallbackURL` from the main bundle.
    ///
    /// Returns `nil` when they're absent, which is a supported state: the
    /// starter renders local fallback content and shows a setup notice rather
    /// than crashing on launch. A starter you can't run before signing up
    /// isn't a starter.
    public static func fromInfoPlist(bundle: Bundle = .main) -> BdConfiguration? {
        func string(_ key: String) -> String? {
            (bundle.object(forInfoDictionaryKey: key) as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .nilIfEmpty
        }

        // Host has a sensible default; the key and site id do not — without
        // those there is nothing to talk to.
        let hostString = string("BDHost") ?? "https://www.biab.app"

        guard
            let host = URL(string: hostString),
            let key = string("BDPublishableKey"),
            let siteID = string("BDSiteID")
        else { return nil }

        return BdConfiguration(
            host: host,
            publishableKey: key,
            siteID: siteID,
            authCallbackURL: string("BDAuthCallbackURL")
        )
    }

    public var client: BdClient {
        BdClient(host: host, publishableKey: publishableKey, siteID: siteID)
    }
}
