import SwiftUI

/// A BD form, rendered with native controls.
///
/// Give it a form slug and a backend; it loads the form, shows each element
/// as the platform control for it, applies BD's conditions, calculations and
/// validation as the visitor answers, uploads files, and submits.
///
/// ```swift
/// let backend = BdPackageFormsBackend(
///     host: URL(string: "https://businessdash.us")!,
///     publishableKey: "pk_live_…"
/// )
///
/// BdForm(form: "contact", backend: backend) { result in
///     print("Submitted", result.submissionId ?? "")
/// }
/// .bdFormStyle(BdFormStyle(tint: .indigo))
/// ```
///
/// For your own UI over the same rules, use ``BdFormController`` directly.
public struct BdForm: View {
    @State private var controller: BdFormController
    private let onSubmitted: (@MainActor (BdSubmitSuccess) -> Void)?
    private let successContent: (@MainActor (BdSubmitSuccess) -> AnyView)?

    @Environment(\.bdFormStyle) private var style
    @Environment(\.bdFormStrings) private var strings

    /// Load `form` (its slug) from `backend` and render it.
    public init(
        form: String,
        backend: any BdFormsBackend,
        submitOptions: BdSubmitOptions = BdSubmitOptions(),
        onSubmitted: (@MainActor (BdSubmitSuccess) -> Void)? = nil
    ) {
        _controller = State(initialValue: BdFormController(form: form, backend: backend, submitOptions: submitOptions))
        self.onSubmitted = onSubmitted
        self.successContent = nil
    }

    /// Load `form` from BD's Package API with a publishable key.
    public init(
        form: String,
        host: URL = URL(string: "https://businessdash.us")!,
        publishableKey: String,
        submitOptions: BdSubmitOptions = BdSubmitOptions(),
        onSubmitted: (@MainActor (BdSubmitSuccess) -> Void)? = nil
    ) {
        self.init(
            form: form,
            backend: BdPackageFormsBackend(host: host, publishableKey: publishableKey),
            submitOptions: submitOptions,
            onSubmitted: onSubmitted
        )
    }

    /// Render a controller you own (to read values, prefill, or drive
    /// navigation from outside).
    public init(controller: BdFormController, onSubmitted: (@MainActor (BdSubmitSuccess) -> Void)? = nil) {
        _controller = State(initialValue: controller)
        self.onSubmitted = onSubmitted
        self.successContent = nil
    }

    init(
        controller: State<BdFormController>,
        onSubmitted: (@MainActor (BdSubmitSuccess) -> Void)?,
        successContent: (@MainActor (BdSubmitSuccess) -> AnyView)?
    ) {
        _controller = controller
        self.onSubmitted = onSubmitted
        self.successContent = successContent
    }

    /// Replace the thank-you screen shown after a successful submit.
    public func successView(@ViewBuilder _ content: @escaping @MainActor (BdSubmitSuccess) -> some View) -> BdForm {
        BdForm(controller: _controller, onSubmitted: onSubmitted, successContent: { AnyView(content($0)) })
    }

    public var body: some View {
        content
            .environment(controller)
            .tint(style.tint)
            .task {
                controller.messages = strings.messages
                await controller.load()
            }
            .onChange(of: controller.isSubmitted) { _, submitted in
                if submitted, case .success(let ok)? = controller.result { onSubmitted?(ok) }
            }
            .interactiveDismissDisabled(controller.settings.exitConfirm?.enabled == true && controller.isDirty && !controller.isSubmitted)
    }

    @ViewBuilder
    private var content: some View {
        switch controller.phase {
        case .idle, .loading:
            ProgressView(strings.loading)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .failed(let message):
            ContentUnavailableView {
                Label(strings.loadFailed, systemImage: "exclamationmark.triangle")
            } description: {
                Text(message)
            } actions: {
                Button(strings.retry) { Task { await controller.load() } }
                    .buttonStyle(.bordered)
            }
        case .ready:
            if controller.isSubmitted, case .success(let ok)? = controller.result {
                if let successContent { successContent(ok) } else { BdSuccessView() }
            } else {
                BdFormBody()
            }
        }
    }
}

/// The thank-you screen.
struct BdSuccessView: View {
    @Environment(BdFormController.self) private var controller
    @Environment(\.bdFormStrings) private var strings

    var body: some View {
        ContentUnavailableView {
            Label(strings.successTitle, systemImage: "checkmark.circle.fill")
                .symbolRenderingMode(.hierarchical)
                .foregroundStyle(.tint)
        } description: {
            Text(strings.successMessage)
        } actions: {
            Button(strings.submitAnother) { controller.reset() }
                .buttonStyle(.bordered)
        }
    }
}

/// Header, the current step's fields, and the navigation buttons, in the
/// style's layout.
struct BdFormBody: View {
    @Environment(BdFormController.self) private var controller
    @Environment(\.bdFormStyle) private var style
    @Environment(\.bdFormStrings) private var strings

    var body: some View {
        ScrollViewReader { proxy in
            Group {
                switch style.layout {
                case .grouped:
                    Form {
                        header
                        BdFieldTree(nodes: controller.visibleFields, entries: [])
                        footer
                    }
                    .environment(\.bdRowMode, .section)
                case .plain:
                    ScrollView {
                        VStack(alignment: .leading, spacing: style.spacing) {
                            header
                            BdFieldTree(nodes: controller.visibleFields, entries: [])
                            footer
                        }
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .environment(\.bdRowMode, .inline)
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .animation(style.animation, value: controller.currentStep)
            .animation(style.animation, value: controller.errors)
            .onChange(of: controller.errorScrollToken) { _, _ in
                guard let key = firstErrorKey() else { return }
                withAnimation(style.animation) { proxy.scrollTo(key, anchor: .top) }
            }
        }
    }

    /// The first field with an error, in the order the visitor sees them.
    func firstErrorKey() -> String? {
        var order: [String] = []
        func walk(_ nodes: [BdFormField], prefix: String) {
            for n in nodes {
                order.append(prefix + n.id)
                if n.type == "multi_populator" {
                    let count = controller.value(n.id)?.arrayValue?.count ?? 1
                    for i in 0..<max(count, 1) { walk(n.children ?? [], prefix: "\(prefix)\(n.id)[\(i)].") }
                } else {
                    walk(n.children ?? [], prefix: prefix)
                }
            }
        }
        walk(controller.visibleFields, prefix: "")
        return order.first { controller.errors[$0] != nil }
    }

    @ViewBuilder
    private var header: some View {
        let schema = controller.schema
        let title = style.showsTitle ? schema?.title.flatMap { $0.isEmpty ? nil : $0 } : nil
        let description = style.showsDescription ? schema?.description.flatMap { $0.isEmpty ? nil : $0 } : nil
        let showProgress = style.showsProgress && controller.isConsecutive && controller.settings.showProgress != false
            && controller.stepCount > 1
        if title != nil || description != nil || showProgress {
            BdBlock {
                VStack(alignment: .leading, spacing: 8) {
                    if let title { Text(title).font(.title2.bold()) }
                    if let description { Text(description).foregroundStyle(.secondary) }
                    if showProgress { BdProgress() }
                }
                .padding(.vertical, style.layout == .grouped ? 4 : 0)
            }
        }
    }

    @ViewBuilder
    private var footer: some View {
        BdBlock {
            VStack(alignment: .leading, spacing: 12) {
                if let notice = failureNotice {
                    Label(notice, systemImage: "exclamationmark.circle.fill")
                        .font(.callout)
                        .foregroundStyle(style.errorColor)
                }
                if let coupon = couponNotice {
                    VStack(alignment: .leading, spacing: 4) {
                        Label(coupon.text, systemImage: "tag.fill").font(.callout)
                        if let fine = coupon.finePrint { Text(fine).font(.caption).foregroundStyle(.secondary) }
                    }
                }
                BdNavigationButtons()
            }
        }
    }

    private var failureNotice: String? {
        guard case .failure(let f)? = controller.result, !controller.isSubmitting else { return nil }
        switch f.reason {
        case .clientValidationFailed, .validationFailed:
            return controller.errors.isEmpty ? f.message : strings.errorNotice
        default:
            return f.message
        }
    }

    private var couponNotice: (text: String, finePrint: String?)? {
        guard controller.isLastStep,
              let coupon = controller.schema?.actions.first(where: { $0.coupon?.code?.isEmpty == false })?.coupon,
              let code = coupon.code else { return nil }
        let text = coupon.notice.map { $0.replacingOccurrences(of: "{code}", with: code) }
            ?? strings.format(strings.couponApplied, code)
        return (text, coupon.finePrint)
    }
}

struct BdProgress: View {
    @Environment(BdFormController.self) private var controller
    @Environment(\.bdFormStrings) private var strings

    var body: some View {
        let current = controller.currentStep, count = controller.stepCount
        VStack(alignment: .leading, spacing: 6) {
            if controller.settings.progressStyle == "steps" {
                HStack(spacing: 6) {
                    ForEach(0..<count, id: \.self) { i in
                        Capsule()
                            .fill(i <= current ? AnyShapeStyle(.tint) : AnyShapeStyle(.quaternary))
                            .frame(height: 4)
                    }
                }
            } else {
                ProgressView(value: controller.progress)
            }
            Text(strings.format(strings.stepOf, current + 1, count) + " · " + controller.stepTitle(current))
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .accessibilityElement(children: .combine)
    }
}

struct BdNavigationButtons: View {
    @Environment(BdFormController.self) private var controller
    @Environment(\.bdFormStyle) private var style
    @Environment(\.bdFormStrings) private var strings

    var body: some View {
        HStack(spacing: 12) {
            if controller.isConsecutive && !controller.isFirstStep {
                Button(strings.back) { withAnimation(style.animation) { controller.back() } }
                    .buttonStyle(.bordered)
                    .controlSize(.large)
                    .disabled(controller.isSubmitting)
            }
            primary
                .frame(maxWidth: .infinity)
        }
    }

    @ViewBuilder
    private var primary: some View {
        let isSubmit = !controller.isConsecutive || controller.isLastStep
        let button = Button {
            if isSubmit {
                Task { await controller.submit() }
            } else {
                withAnimation(style.animation) { _ = controller.next() }
            }
        } label: {
            HStack(spacing: 8) {
                if controller.isSubmitting { ProgressView().controlSize(.small) }
                Text(isSubmit ? (controller.isSubmitting ? strings.sending : strings.submit) : strings.next)
                    .frame(maxWidth: .infinity)
            }
        }
        .controlSize(.large)
        .disabled(controller.isSubmitting)
        switch style.submitButton {
        case .prominent: button.buttonStyle(.borderedProminent)
        case .standard: button.buttonStyle(.bordered)
        case .glass: button.buttonStyle(.glassProminent)
        }
    }
}

/// A block that sits in the form's flow: a section in the grouped layout,
/// plain content in the stacked one.
struct BdBlock<Content: View>: View {
    @Environment(\.bdRowMode) private var mode
    @ViewBuilder let content: Content

    var body: some View {
        if mode == .section {
            Section { content }
        } else {
            content
        }
    }
}

enum BdRowMode: Sendable { case section, inline }

extension EnvironmentValues {
    @Entry var bdRowMode: BdRowMode = .inline
}
