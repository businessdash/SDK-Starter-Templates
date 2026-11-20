import SwiftUI

/// How a ``BdForm`` looks. Everything defaults to the platform: system
/// fonts, your app's accent color, a grouped `Form` like Settings. Change
/// what you want and the rest stays native.
///
/// ```swift
/// BdForm(form: "contact", backend: backend)
///     .bdFormStyle(BdFormStyle(layout: .plain, tint: .indigo))
/// ```
public struct BdFormStyle: Sendable {
    public enum Layout: Sendable {
        /// A grouped `Form`: one section per question, label as the header,
        /// help and errors as the footer.
        case grouped
        /// A scrolling stack of fields with no list background, for a form
        /// embedded in a screen with its own design.
        case plain
    }

    public enum ButtonProminence: Sendable { case prominent, standard, glass }

    public var layout: Layout
    /// Tint for controls, selections and the submit button. `nil` = the app's accent.
    public var tint: Color?
    public var errorColor: Color
    public var showsTitle: Bool
    public var showsDescription: Bool
    /// Appended to required labels. Empty to hide.
    public var requiredMarker: String
    /// Space between fields in the plain layout.
    public var spacing: CGFloat
    /// Corner radius of cards and chips.
    public var cornerRadius: CGFloat
    public var submitButton: ButtonProminence
    /// Step changes, reveals and errors animate with this; `nil` for none.
    /// The form's own `animation` setting picks the step transition.
    public var animation: Animation?
    /// Show the step progress when the form asks for it.
    public var showsProgress: Bool

    public init(
        layout: Layout = .grouped,
        tint: Color? = nil,
        errorColor: Color = .red,
        showsTitle: Bool = true,
        showsDescription: Bool = true,
        requiredMarker: String = " *",
        spacing: CGFloat = 20,
        cornerRadius: CGFloat = 12,
        submitButton: ButtonProminence = .prominent,
        animation: Animation? = .snappy,
        showsProgress: Bool = true
    ) {
        self.layout = layout
        self.tint = tint
        self.errorColor = errorColor
        self.showsTitle = showsTitle
        self.showsDescription = showsDescription
        self.requiredMarker = requiredMarker
        self.spacing = spacing
        self.cornerRadius = cornerRadius
        self.submitButton = submitButton
        self.animation = animation
        self.showsProgress = showsProgress
    }
}

/// Every word the renderer shows that isn't from the form itself. Replace
/// any to reword or localize; validation messages go through ``messages``.
public struct BdFormStrings: Sendable {
    public var next = "Next"
    public var back = "Back"
    public var submit = "Submit"
    public var sending = "Sending…"
    public var successTitle = "Thank you"
    public var successMessage = "Thanks — your response was received."
    public var submitAnother = "Submit another response"
    public var errorNotice = "Please complete the highlighted field(s)."
    public var loading = "Loading form…"
    public var loadFailed = "This form couldn't be loaded."
    public var retry = "Try again"
    public var stepOf = "Step %d of %d"
    public var select = "Select…"
    public var search = "Search"
    public var noResults = "No matches"
    public var useCustom = "Use “%@”"
    public var done = "Done"
    public var clear = "Clear"
    public var addAnother = "Add another"
    public var entry = "Entry"
    public var removeEntry = "Remove entry"
    public var fillOneSide = "Fill at least one side"
    public var or = "OR"
    public var yesNo = "Yes / No"
    public var addDate = "Add date"
    public var addTime = "Add time"
    public var start = "Start"
    public var end = "End"
    public var date = "Date"
    public var time = "Time"
    public var selectTime = "Select time"
    public var month = "Month"
    public var year = "Year"
    public var namePrefix = "Title"
    public var firstName = "First name"
    public var middleName = "Middle name"
    public var lastName = "Last name"
    public var nameSuffix = "Suffix"
    public var nicknames = "Nicknames"
    public var nicknamesPlaceholder = "Johnny, JM — separate with commas"
    public var addressLine1 = "Address Line 1"
    public var addressLine2 = "Address Line 2"
    public var city = "City"
    public var state = "State"
    public var selectState = "Select state"
    public var zip = "Zip"
    public var customColor = "Custom color"
    public var chooseFiles = "Choose files"
    public var choosePhotos = "Choose photos"
    public var uploadsOnSubmit = "Uploads on submit"
    public var upload = "Upload"
    public var pasteURL = "Paste URL"
    public var removeFile = "Remove"
    public var addTag = "Add a tag"
    public var asap = "As soon as possible"
    public var preferredDays = "Preferred days"
    public var preferredTimes = "Preferred times"
    public var schedulingNotes = "Anything we should know about timing?"
    public var loadingTimes = "Loading available times…"
    public var noOpenTimes = "No open times in the next few weeks."
    public var loadingOptions = "Loading options…"
    public var calculatedOnSubmit = "Calculated on submit."
    public var cardOnFile = "Card on file"
    public var deposit = "Deposit"
    public var addCard = "Add card"
    public var cardSaved = "Card saved"
    public var searchIcons = "Search icons…"
    public var view = "View"
    public var hour = "hr"
    public var hours = "hrs"
    public var couponApplied = "Coupon %@ will be applied to this submission."
    public var exitTitle = "Leave this form?"
    public var exitMessage = "Your answers haven't been sent."
    public var exitLeave = "Leave"
    public var exitStay = "Keep editing"
    public var dayNames: [String: String] = [
        "mon": "Mon", "tue": "Tue", "wed": "Wed", "thu": "Thu", "fri": "Fri", "sat": "Sat", "sun": "Sun",
    ]
    public var timeWindowNames: [String: String] = [
        "morning": "Morning", "afternoon": "Afternoon", "evening": "Evening",
        "morning_8_10": "8–10 AM", "morning_10_12": "10 AM–12 PM",
        "afternoon_12_2": "12–2 PM", "afternoon_2_4": "2–4 PM",
        "evening_4_6": "4–6 PM", "evening_6_8": "6–8 PM",
    ]
    /// Validation messages, by reason (`required`, `format`, `max`, …).
    public var messages: @Sendable (_ reason: String, _ label: String, _ field: BdFormField?) -> String =
        BdFormMessages.message(reason:label:field:)

    public init() {}
}

/// What a custom renderer gets: the field, its value and error, and the
/// controller to write through.
@MainActor
public struct BdFieldContext {
    public let field: BdFormField
    public let path: BdFieldPath
    public let controller: BdFormController

    public var value: BdJSON? { controller.value(path) }
    public var error: String? { controller.error(for: path) }

    public func set(_ value: BdJSON?) { controller.setValue(value, at: path) }
    /// Call when the visitor leaves the control, to show a format problem.
    public func commit() { controller.validate(path) }

    /// A text binding for string-valued fields.
    public var text: Binding<String> {
        Binding(get: { value?.stringValue ?? "" }, set: { set(.string($0)) })
    }
}

/// Replace how an element type, or one specific field, is drawn. The
/// field's label, help and error are still drawn around your view.
public struct BdFieldRenderers: Sendable {
    public typealias Renderer = @MainActor @Sendable (BdFieldContext) -> AnyView
    var byType: [String: Renderer] = [:]
    var byField: [String: Renderer] = [:]

    public init() {}

    @MainActor
    func renderer(for field: BdFormField) -> Renderer? {
        byField[field.id] ?? field.key.flatMap { byField[$0] } ?? byType[field.type]
    }
}

extension EnvironmentValues {
    @Entry public var bdFormStyle = BdFormStyle()
    @Entry public var bdFormStrings = BdFormStrings()
    @Entry public var bdFieldRenderers = BdFieldRenderers()
    /// Where element icons come from (`{base}/api/icons/{name}.svg`).
    @Entry public var bdIconBaseURL = URL(string: "https://www.businessdash.us")!
}

extension View {
    public func bdFormStyle(_ style: BdFormStyle) -> some View {
        environment(\.bdFormStyle, style)
    }

    public func bdFormStrings(_ strings: BdFormStrings) -> some View {
        environment(\.bdFormStrings, strings)
    }

    /// Draw every field of `type` with your own view.
    ///
    /// ```swift
    /// .bdFieldRenderer(for: "star_rating") { ctx in
    ///     MyStars(value: ctx.value?.doubleValue ?? 0) { ctx.set(.number($0)) }
    /// }
    /// ```
    public func bdFieldRenderer(
        for type: String,
        @ViewBuilder _ render: @escaping @MainActor @Sendable (BdFieldContext) -> some View
    ) -> some View {
        transformEnvironment(\.bdFieldRenderers) { $0.byType[type] = { AnyView(render($0)) } }
    }

    /// Draw one field (by id or output key) with your own view.
    public func bdFieldRenderer(
        forField idOrKey: String,
        @ViewBuilder _ render: @escaping @MainActor @Sendable (BdFieldContext) -> some View
    ) -> some View {
        transformEnvironment(\.bdFieldRenderers) { $0.byField[idOrKey] = { AnyView(render($0)) } }
    }

    public func bdIconBaseURL(_ url: URL) -> some View {
        environment(\.bdIconBaseURL, url)
    }
}

extension BdFormStrings {
    func format(_ template: String, _ args: CVarArg...) -> String {
        String(format: template, arguments: args)
    }
}
