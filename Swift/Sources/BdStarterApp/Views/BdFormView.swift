import BdForms
import BusinessDashKit
import SwiftUI

/// An org-defined form, rendered natively.
///
/// `BdForm` (from the `BdForms` library in this package) does the work: it
/// loads the form by slug, draws every BD element as the platform control
/// for it, applies the form's conditions, steps, calculations and
/// validation as the visitor answers, uploads files, and submits with the
/// same rules the server checks. This view only supplies the keys from
/// `BdEnvironment`.
///
/// Style it like any SwiftUI view:
///
/// ```swift
/// BdFormView(slug: "contact")
///     .bdFormStyle(BdFormStyle(tint: .indigo))
/// ```
public struct BdFormView: View {
    let slug: String
    var onSubmitted: (@MainActor (BdSubmitSuccess) -> Void)?

    @Environment(BdEnvironment.self) private var bd

    public init(slug: String, onSubmitted: (@MainActor (BdSubmitSuccess) -> Void)? = nil) {
        self.slug = slug
        self.onSubmitted = onSubmitted
    }

    public var body: some View {
        if let configuration = bd.configuration {
            BdForm(
                form: slug,
                host: configuration.host,
                publishableKey: configuration.publishableKey,
                submitOptions: BdSubmitOptions(source: "ios-app"),
                onSubmitted: onSubmitted
            )
            // A new slug is a new form, not an edit of this one.
            .id(slug)
        } else {
            ContentUnavailableView(
                "Form unavailable",
                systemImage: "doc.text",
                description: Text("Set BDPublishableKey and BDSiteID in Info.plist.")
            )
        }
    }
}
