import SwiftUI

/// The native control for one element, by type.
public struct BdFieldControl: View {
    let ctx: BdFieldContext

    public init(ctx: BdFieldContext) { self.ctx = ctx }

    // One `AnyView` per element: a 40-way `switch` as a single generic view
    // type makes SwiftUI lay out every control's metadata on first render
    // (tens of seconds in a debug build). Erased, only the controls a form
    // actually uses are ever laid out.
    public var body: some View { control }

    private var control: AnyView {
        switch ctx.field.type {
        // Static
        case "title", "subtitle", "separator", "richtext", "body_text", "bullet_list", "table", "image":
            AnyView(BdStaticContent(field: ctx.field))
        case "calculation":
            AnyView(BdCalculationView(ctx: ctx))
        // Text
        case "textarea": AnyView(BdTextAreaControl(ctx: ctx))
        case "email": AnyView(BdTextControl(ctx: ctx, kind: .email))
        case "phone": AnyView(BdPhoneControl(ctx: ctx))
        case "url": AnyView(BdURLControl(ctx: ctx))
        case "number": AnyView(BdNumberControl(ctx: ctx))
        case "currency": AnyView(BdCurrencyControl(ctx: ctx))
        case "measurement": AnyView(BdMeasurementControl(ctx: ctx))
        case "name": AnyView(BdNameControl(ctx: ctx))
        case "address": AnyView(BdAddressControl(ctx: ctx))
        case "tags": AnyView(BdTagsControl(ctx: ctx))
        case "rich_text_input": AnyView(BdRichTextControl(ctx: ctx))
        // Choices
        case "select": AnyView(BdSelectControl(ctx: ctx))
        case "radio": AnyView(BdRadioControl(ctx: ctx))
        case "checkbox": AnyView(BdCheckboxControl(ctx: ctx))
        case "choice_cards": AnyView(BdChoiceCardsControl(ctx: ctx))
        case "boolean": AnyView(BdBooleanControl(ctx: ctx))
        case "icon_select": AnyView(BdIconSelectControl(ctx: ctx))
        case "service_selector": AnyView(BdServiceControl(ctx: ctx))
        case "collection_select": AnyView(BdCollectionControl(ctx: ctx))
        case "color_picker": AnyView(BdColorControl(ctx: ctx))
        case "slider": AnyView(BdSliderControl(ctx: ctx))
        case "star_rating": AnyView(BdStarsControl(ctx: ctx))
        case "happiness_rating": AnyView(BdHappinessControl(ctx: ctx))
        case "stepper": AnyView(BdStepperControl(ctx: ctx))
        // Dates
        case "date": AnyView(BdDateControl(ctx: ctx))
        case "date_range": AnyView(BdDateRangeControl(ctx: ctx))
        case "time_picker": AnyView(BdTimeControl(ctx: ctx))
        case "month_year": AnyView(BdMonthYearControl(ctx: ctx))
        case "schedule":
            ctx.field.scheduleConfig?.mode == "auto" ? AnyView(BdBookingControl(ctx: ctx)) : AnyView(BdAvailabilityControl(ctx: ctx)) 
        // Media & payment
        case "file_upload": AnyView(BdFileControl(ctx: ctx))
        case "image_input": AnyView(BdImageInputControl(ctx: ctx))
        case "credit_card": AnyView(BdCardControl(ctx: ctx))
        default:
            AnyView(BdTextControl(ctx: ctx, kind: .text))
        }
    }
}

// MARK: - Text input plumbing

enum BdKeyboard {
    case text, email, phone, url, decimal, integer, signedDecimal, zip
}

extension View {
    /// Keyboard, capitalization and correction for a kind of input.
    @ViewBuilder
    func bdKeyboard(_ kind: BdKeyboard) -> some View {
        #if os(iOS)
        switch kind {
        case .text: self
        case .email: self.keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
        case .phone: self.keyboardType(.phonePad)
        case .url: self.keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
        case .decimal: self.keyboardType(.decimalPad)
        case .integer: self.keyboardType(.numberPad)
        case .signedDecimal: self.keyboardType(.numbersAndPunctuation)
        case .zip: self.keyboardType(.numberPad)
        }
        #else
        self
        #endif
    }

    /// Advertise an autofill token (HTML `autocomplete` vocabulary) as the
    /// platform's content type, so AutoFill offers the visitor's details.
    @ViewBuilder
    func bdAutofill(_ token: String?) -> some View {
        #if os(iOS)
        if let type = BdAutofill.contentType(token) {
            self.textContentType(type)
        } else if token == "off" {
            self.textContentType(nil)
        } else {
            self
        }
        #else
        self
        #endif
    }
}

enum BdAutofill {
    #if os(iOS)
    static func contentType(_ token: String?) -> UITextContentType? {
        switch token {
        case "name": .name
        case "given-name": .givenName
        case "additional-name": .middleName
        case "family-name": .familyName
        case "honorific-prefix": .namePrefix
        case "honorific-suffix": .nameSuffix
        case "nickname": .nickname
        case "organization": .organizationName
        case "organization-title": .jobTitle
        case "email": .emailAddress
        case "tel", "tel-national": .telephoneNumber
        case "url": .URL
        case "street-address": .fullStreetAddress
        case "address-line1": .streetAddressLine1
        case "address-line2": .streetAddressLine2
        case "address-level2": .addressCity
        case "address-level1": .addressState
        case "postal-code": .postalCode
        case "country", "country-name": .countryName
        case "bday": .birthdate
        case "username": .username
        case "one-time-code": .oneTimeCode
        default: nil
        }
    }
    #endif
}

/// A text field that reports when the visitor leaves it, styled for the
/// row mode (a bare field in a grouped section, a bordered one in a stack).
struct BdTextField: View {
    let title: String
    @Binding var text: String
    var prompt: String?
    var keyboard: BdKeyboard = .text
    var autofill: String?
    var axis: Axis = .horizontal
    var lineLimit: ClosedRange<Int>?
    var onCommit: () -> Void = {}

    @FocusState private var focused: Bool
    @Environment(\.bdRowMode) private var mode
    @Environment(\.bdFormStyle) private var style

    var body: some View {
        let field = TextField(title, text: $text, prompt: prompt.map { Text($0) }, axis: axis)
            .lineLimit(lineLimit ?? 1...1)
            .bdKeyboard(keyboard)
            .bdAutofill(autofill)
            .focused($focused)
            .onChange(of: focused) { _, now in if !now { onCommit() } }
            .onSubmit(onCommit)
        if mode == .section {
            field
        } else {
            field
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(.background.secondary, in: RoundedRectangle(cornerRadius: style.cornerRadius * 0.75))
        }
    }
}

/// A labelled sub-field (first name, city…): a prompt-only row in a
/// grouped section, a captioned field in a stack.
struct BdSubField: View {
    let label: String
    @Binding var text: String
    var placeholder: String?
    var keyboard: BdKeyboard = .text
    var autofill: String?
    var onCommit: () -> Void = {}
    @Environment(\.bdRowMode) private var mode

    var body: some View {
        if mode == .section {
            if let placeholder {
                LabeledContent(label) {
                    BdTextField(title: label, text: $text, prompt: placeholder, keyboard: keyboard, autofill: autofill, onCommit: onCommit)
                        .multilineTextAlignment(.trailing)
                }
            } else {
                // No example to show: the label is the prompt, as in Contacts.
                BdTextField(title: label, text: $text, prompt: label, keyboard: keyboard, autofill: autofill, onCommit: onCommit)
            }
        } else {
            VStack(alignment: .leading, spacing: 4) {
                Text(label).font(.caption).foregroundStyle(.secondary)
                BdTextField(title: label, text: $text, prompt: placeholder, keyboard: keyboard, autofill: autofill, onCommit: onCommit)
            }
        }
    }
}

/// Rows grouped as list rows in a section, or as a card in a stack.
struct BdRows<Content: View>: View {
    @ViewBuilder let content: Content
    @Environment(\.bdRowMode) private var mode
    @Environment(\.bdFormStyle) private var style

    var body: some View {
        if mode == .section {
            content
        } else {
            VStack(spacing: 0) {
                Group(subviews: content) { subviews in
                    ForEach(Array(subviews.enumerated()), id: \.offset) { i, sub in
                        if i > 0 { Divider().padding(.leading, 12) }
                        sub.padding(.horizontal, 12).padding(.vertical, 10)
                    }
                }
            }
            .background(.background.secondary, in: RoundedRectangle(cornerRadius: style.cornerRadius))
        }
    }
}

/// One selectable row: radio (trailing checkmark) or checkbox (leading circle).
struct BdChoiceRow<Label: View>: View {
    let selected: Bool
    let multi: Bool
    let action: () -> Void
    @ViewBuilder let label: Label

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                if multi {
                    Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                        .font(.title3)
                        .foregroundStyle(selected ? AnyShapeStyle(.tint) : AnyShapeStyle(.tertiary))
                        .contentTransition(.symbolEffect(.replace))
                }
                label
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .foregroundStyle(.primary)
                if !multi && selected {
                    Image(systemName: "checkmark").fontWeight(.semibold).foregroundStyle(.tint)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? [.isSelected] : [])
    }
}

/// A toggleable capsule.
struct BdChip: View {
    let title: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.medium))
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .foregroundStyle(selected ? AnyShapeStyle(.white) : AnyShapeStyle(.primary))
                .background(selected ? AnyShapeStyle(.tint) : AnyShapeStyle(.fill.tertiary), in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? [.isSelected] : [])
    }
}

/// Lays children out left to right, wrapping to new lines.
struct BdFlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0, maxX: CGFloat = 0
        for s in subviews {
            let size = s.sizeThatFits(.unspecified)
            if x > 0, x + size.width > width {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            x += size.width + spacing
            maxX = max(maxX, x - spacing)
            rowHeight = max(rowHeight, size.height)
        }
        return CGSize(width: proposal.width ?? maxX, height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowHeight: CGFloat = 0
        for s in subviews {
            let size = s.sizeThatFits(.unspecified)
            if x > bounds.minX, x + size.width > bounds.maxX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            s.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}

/// Drop-in-a-row container for a control that isn't a list of rows.
struct BdCard<Content: View>: View {
    @ViewBuilder let content: Content
    @Environment(\.bdRowMode) private var mode
    @Environment(\.bdFormStyle) private var style

    var body: some View {
        if mode == .section {
            content
        } else {
            content
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(.background.secondary, in: RoundedRectangle(cornerRadius: style.cornerRadius))
        }
    }
}

extension BdJSON {
    /// `String(value)` for display, empty for null.
    var displayText: String { isNull ? "" : BdJS.string(self) }
}
