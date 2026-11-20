import Foundation
import Observation

/// Where a value lives: a field id, inside zero or more repeater entries.
public struct BdFieldPath: Hashable, Sendable {
    public struct Entry: Hashable, Sendable {
        public let repeaterId: String
        public let index: Int
    }

    public let entries: [Entry]
    public let fieldId: String

    public init(_ fieldId: String, in entries: [Entry] = []) {
        self.fieldId = fieldId
        self.entries = entries
    }

    /// `email`, or `kids[1].name` inside a repeater. Errors are keyed by this.
    public var key: String {
        entries.map { "\($0.repeaterId)[\($0.index)]." }.joined() + fieldId
    }

    public func child(_ id: String) -> BdFieldPath { BdFieldPath(id, in: entries) }

    public func entry(_ index: Int) -> [Entry] { entries + [Entry(repeaterId: fieldId, index: index)] }
}

public enum BdLoadState<Value: Sendable>: Sendable {
    case idle
    case loading
    case loaded(Value)
    case failed(String)

    public var value: Value? { if case .loaded(let v) = self { return v } else { return nil } }
}

/// Options sent with every submit.
public struct BdSubmitOptions: Sendable {
    public var submitterEmail: String?
    public var submitterName: String?
    public var dryRun: Bool
    /// Where the submission came from, e.g. `ios-app`.
    public var source: String?
    public var referrer: String?
    public var metadata: [String: BdJSON]?

    public init(
        submitterEmail: String? = nil,
        submitterName: String? = nil,
        dryRun: Bool = false,
        source: String? = "ios-app",
        referrer: String? = nil,
        metadata: [String: BdJSON]? = nil
    ) {
        self.submitterEmail = submitterEmail
        self.submitterName = submitterName
        self.dryRun = dryRun
        self.source = source
        self.referrer = referrer
        self.metadata = metadata
    }
}

/// The headless form: state and behaviour, no UI.
///
/// ``BdForm`` renders one of these, and an app that wants its own UI can
/// drive it directly. It is the native `useForm`: values, errors, steps and
/// submission, with BD's rules applied exactly as the server applies them.
///
/// ```swift
/// @State var form = BdFormController(form: "contact", backend: backend)
///
/// TextField("Email", text: form.binding(text: "email"))
/// if let error = form.error(for: "email") { Text(error) }
/// Button("Send") { Task { await form.submit() } }
///     .disabled(form.isSubmitting)
/// ```
@MainActor
@Observable
public final class BdFormController {
    public enum Phase: Equatable, Sendable {
        case idle, loading, ready
        case failed(String)
    }

    /// The form's slug.
    public let form: String
    public let backend: (any BdFormsBackend)?

    public private(set) var phase: Phase = .idle
    public private(set) var schema: BdFormSchema?
    public private(set) var values: [String: BdJSON] = [:]
    /// Field path key → message.
    public private(set) var errors: [String: String] = [:]
    public private(set) var step = 0
    public private(set) var movingForward = true
    public private(set) var isSubmitting = false
    public private(set) var uploadingCount = 0
    public private(set) var result: BdSubmitResult?
    /// Set when the visitor has tried to submit or advance: from then on
    /// required errors show as they edit, not just on the next attempt.
    public private(set) var hasAttempted = false
    /// Bumped each time an attempt to advance or submit surfaces errors, so a
    /// view can scroll to the first one.
    public private(set) var errorScrollToken = 0
    public private(set) var collectionOptions: [String: BdLoadState<[BdCollectionOption]>] = [:]
    public private(set) var scheduleSlots: [String: BdLoadState<[String]>] = [:]

    public var submitOptions: BdSubmitOptions
    public var onSuccess: (@MainActor (BdSubmitSuccess) -> Void)?
    public var onFailure: (@MainActor (BdSubmitFailure) -> Void)?
    /// Collect a card for a `credit_card` field. BD creates the Stripe intent
    /// on the org's connected account; your handler presents Stripe's own
    /// sheet with it and returns the confirmed intent id. Card details never
    /// pass through this package or BD.
    public var paymentHandler: (@MainActor (BdPaymentIntent, BdFormField) async throws -> String)?
    /// What a visitor reads for a problem. Replace to localize or reword;
    /// the default is ``BdFormMessages/message(reason:label:field:)``.
    public var messages: @Sendable (_ reason: String, _ label: String, _ field: BdFormField?) -> String =
        BdFormMessages.message(reason:label:field:)

    func message(reason: String, label: String, field: BdFormField?) -> String {
        messages(reason, label, field)
    }

    @ObservationIgnored var pendingFiles: [String: BdPickedFile] = [:]
    @ObservationIgnored var seed: [String: BdJSON] = [:]
    @ObservationIgnored var functionsById: [String: BdBusinessFunction] = [:]
    @ObservationIgnored var userFunctions: [String: BdFormula.UserFunction] = [:]
    @ObservationIgnored var calcFields: [BdFormField] = []
    @ObservationIgnored var fieldIndex: [String: BdFormField] = [:]

    public init(form: String, backend: any BdFormsBackend, submitOptions: BdSubmitOptions = BdSubmitOptions()) {
        self.form = form
        self.backend = backend
        self.submitOptions = submitOptions
    }

    /// A form you already have (prefetched, bundled, or built in code). Pass a
    /// backend to be able to submit it.
    public init(schema: BdFormSchema, backend: (any BdFormsBackend)? = nil, submitOptions: BdSubmitOptions = BdSubmitOptions()) {
        self.form = schema.slug
        self.backend = backend
        self.submitOptions = submitOptions
        adopt(schema)
    }

    /// Fetch the form. Safe to call again (a retry after a failure).
    public func load() async {
        if case .ready = phase { return }
        guard let backend else {
            phase = .failed("No backend to load \"\(form)\" from.")
            return
        }
        phase = .loading
        do {
            adopt(try await backend.schema(form: form))
        } catch {
            phase = .failed((error as? LocalizedError)?.errorDescription ?? "Couldn't load the form.")
        }
    }

    func adopt(_ loaded: BdFormSchema) {
        schema = loaded
        fieldIndex = BdFormRules.fieldsById(loaded.fields)
        functionsById = Dictionary(loaded.businessFunctions.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        userFunctions = BdFormula.userFunctions(
            Dictionary(loaded.businessFunctions.map { ($0.slug.uppercased(), $0) }, uniquingKeysWith: { a, _ in a })
        )
        calcFields = fieldIndex.values.filter { $0.type == "calculation" }
        seed = applyCalcs(BdFormRules.seedInitialData(loaded.fields))
        values = seed
        errors = [:]
        step = 0
        movingForward = true
        result = nil
        hasAttempted = false
        pendingFiles = [:]
        phase = .ready
        // Conditions that compare a collection record's column need the
        // records loaded before they can evaluate.
        for f in fieldIndex.values where f.conditionRule?.matchField != nil {
            if let source = f.conditionRule?.fieldId { Task { await loadCollectionOptions(source) } }
        }
    }

    // MARK: Schema accessors

    public var fields: [BdFormField] { schema?.fields ?? [] }
    public var settings: BdFormSettings { schema?.settings ?? BdFormSettings() }
    public func field(_ id: String) -> BdFormField? { fieldIndex[id] }

    public var isConsecutive: Bool { settings.isConsecutive == true }

    /// The steps the visitor will walk: one holding everything, or one per
    /// visible top-level element. Re-derived as answers change, because a
    /// condition can add or remove a page.
    public var steps: [[BdFormField]] {
        BdFormRules.computeSteps(fields, consecutive: isConsecutive, resolve: resolver(for: []))
    }

    public var stepCount: Int { max(steps.count, 1) }
    public var currentStep: Int { min(max(step, 0), stepCount - 1) }
    public var visibleFields: [BdFormField] { isConsecutive ? (steps[safe: currentStep] ?? []) : fields }
    public var isFirstStep: Bool { currentStep == 0 }
    public var isLastStep: Bool { currentStep == stepCount - 1 }
    public var progress: Double { Double(currentStep + 1) / Double(stepCount) }

    public func stepTitle(_ index: Int) -> String {
        let f = steps[safe: index]?.first
        return f?.stepTitle ?? (f?.label.isEmpty == false ? f!.label : "Step \(index + 1)")
    }

    public var canAdvance: Bool { problems(in: steps[safe: currentStep] ?? []).isEmpty }
    public var canSubmit: Bool { problems(in: fields).isEmpty }
    public var isSubmitted: Bool { result?.isSuccess == true }
    /// Anything changed since the form loaded (for an exit confirmation).
    public var isDirty: Bool { values != seed }

    // MARK: Values

    public func value(_ path: BdFieldPath) -> BdJSON? {
        scopeValues(path.entries)[path.fieldId]
    }

    public func value(_ id: String) -> BdJSON? { values[id] }

    public func setValue(_ value: BdJSON?, at path: BdFieldPath) {
        values = applyCalcs(Self.write(value, at: path, into: values))
        revalidate(path)
    }

    public func setValue(_ value: BdJSON?, for id: String) { setValue(value, at: BdFieldPath(id)) }

    /// The values a field inside these repeater entries sees.
    public func scopeValues(_ entries: [BdFieldPath.Entry]) -> [String: BdJSON] {
        var scope = values
        for e in entries {
            scope = scope[e.repeaterId]?.arrayValue?[safe: e.index]?.objectValue ?? [:]
        }
        return scope
    }

    static func write(_ value: BdJSON?, at path: BdFieldPath, into root: [String: BdJSON]) -> [String: BdJSON] {
        func go(_ scope: [String: BdJSON], _ entries: ArraySlice<BdFieldPath.Entry>) -> [String: BdJSON] {
            var scope = scope
            guard let e = entries.first else {
                scope[path.fieldId] = value ?? .null
                return scope
            }
            var arr = scope[e.repeaterId]?.arrayValue ?? []
            while arr.count <= e.index { arr.append([:]) }
            arr[e.index] = .object(go(arr[e.index].objectValue ?? [:], entries.dropFirst()))
            scope[e.repeaterId] = .array(arr)
            return scope
        }
        return go(root, path.entries[...])
    }

    func applyCalcs(_ vals: [String: BdJSON]) -> [String: BdJSON] {
        guard !calcFields.isEmpty else { return vals }
        var next = vals
        for f in calcFields {
            guard let cfg = f.calculationConfig else { continue }
            let r = BdCalculation.compute(cfg, resolve: { next[$0] }, functionsById: functionsById, userFunctions: userFunctions)
            next[f.id] = r.ok ? (r.value ?? .null) : .null
        }
        return next
    }

    // MARK: Repeaters

    public func entries(of repeater: BdFieldPath) -> [[String: BdJSON]] {
        let raw = value(repeater)?.arrayValue ?? []
        let objects = raw.map { $0.objectValue ?? [:] }
        return objects.isEmpty ? [[:]] : objects
    }

    public func addEntry(to repeater: BdFieldPath) {
        guard let f = field(repeater.fieldId) else { return }
        var list = entries(of: repeater)
        guard list.count < (f.populatorConfig?.maxInstances ?? 10) else { return }
        list.append([:])
        setValue(.array(list.map { .object($0) }), at: repeater)
    }

    public func removeEntry(at index: Int, from repeater: BdFieldPath) {
        var list = entries(of: repeater)
        guard list.indices.contains(index), list.count > 1 else { return }
        list.remove(at: index)
        // Errors are keyed by entry index; shifting entries invalidates them.
        let prefix = repeater.key + "["
        errors = errors.filter { !$0.key.hasPrefix(prefix) }
        setValue(.array(list.map { .object($0) }), at: repeater)
    }

    // MARK: Conditions

    /// Resolve the value a condition compares, inside the given entries.
    public func resolver(for entries: [BdFieldPath.Entry]) -> (BdConditionRule) -> BdJSON? {
        let scope = entries.isEmpty
            ? BdFormRules.withDerivedFieldValues(fields, BdFormRules.deriveReferenceValues(fields, values))
            : scopeValues(entries)
        let base = BdFormRules.resolver(scope, matchResolver)
        return base
    }

    /// Is this block/page showing right now?
    public func isVisible(_ node: BdFormField, in entries: [BdFieldPath.Entry] = []) -> Bool {
        BdFormRules.isNodeVisible(node, resolve: resolver(for: entries))
    }

    /// Children of a concurrent-reveal group shown so far.
    public func revealCount(_ group: BdFormField, in entries: [BdFieldPath.Entry] = []) -> Int {
        let children = group.children ?? []
        guard group.concurrentReveal == true else { return children.count }
        return BdFormRules.concurrentRevealCount(children, scopeValues(entries))
    }

    var matchResolver: (BdConditionRule, BdJSON?) -> BdJSON? {
        let options = collectionOptions
        return { rule, raw in
            guard let column = rule.matchField, let sourceId = rule.fieldId,
                  let loaded = options[sourceId]?.value else { return raw }
            let index = Dictionary(loaded.map { ($0.value, $0) }, uniquingKeysWith: { a, _ in a })
            func one(_ v: BdJSON) -> BdJSON {
                guard let opt = index[BdJS.string(v)] else { return v }
                if column == "__label__" { return .string(opt.label) }
                return opt.match?[column].map { .string($0) } ?? v
            }
            if let arr = raw?.arrayValue {
                return .string(arr.map { BdJS.string(one($0)) }.joined(separator: ", "))
            }
            return raw.map(one)
        }
    }

    // MARK: Validation

    public func error(for path: BdFieldPath) -> String? { errors[path.key] }
    public func error(for id: String) -> String? { errors[id] }

    /// Required + value problems within these nodes, keyed by path.
    func problems(in nodes: [BdFormField]) -> [String: String] {
        var out: [String: String] = [:]
        for m in BdFormRules.findMissingRequired(nodes, values, resolveMatch: matchResolver) {
            out[m.path] = message(reason: "required", label: m.label, field: field(m.id))
        }
        for bad in BdFormRules.findInvalidValues(nodes, values, resolveMatch: matchResolver) where out[bad.path] == nil {
            out[bad.path] = message(reason: bad.reason, label: bad.label, field: field(bad.id))
        }
        return out
    }

    /// Check one field now (call on blur). Shows a format problem right away;
    /// a missing answer only once the visitor has tried to move on.
    public func validate(_ path: BdFieldPath) {
        guard let f = field(path.fieldId) else { return }
        let scope = scopeValues(path.entries)
        let value = scope[path.fieldId]
        var problem: String?
        if !BdFormRules.isPendingUpload(value),
           let reason = BdFormRules.validateValue(f, value) ?? BdFormRules.clientOnlyRule(f, value)
        {
            problem = message(reason: reason, label: f.label, field: f)
        } else if hasAttempted, (f.required || f.mustBeTrue == true),
                  !BdFieldType.staticOrLayout.contains(f.type), BdFormRules.isEmpty(f, value)
        {
            problem = message(reason: "required", label: f.label, field: f)
        }
        errors[path.key] = problem
    }

    /// After an edit: clear a fixed error, refresh one still wrong, and keep
    /// either/or and repeater errors in step with their contents.
    func revalidate(_ path: BdFieldPath) {
        if errors[path.key] != nil { validate(path) }
        // An either/or or repeater error clears once its requirement is met.
        guard hasAttempted else { return }
        let current = problems(in: fields)
        for key in errors.keys where current[key] == nil {
            if let id = key.split(separator: ".").last.map(String.init), let f = field(id),
               f.type == "or_condition" || f.type == "multi_populator"
            {
                errors[key] = nil
            }
        }
    }

    /// Check the whole form and show every problem. Returns true when clean.
    @discardableResult
    public func validateAll() -> Bool {
        hasAttempted = true
        errors = problems(in: fields)
        if !errors.isEmpty { errorScrollToken += 1 }
        return errors.isEmpty
    }

    // MARK: Navigation

    /// Advance if the current step is complete; otherwise show what's missing.
    @discardableResult
    public func next() -> Bool {
        let all = steps
        let index = currentStep
        guard index < all.count - 1 else { return false }
        hasAttempted = true
        let found = problems(in: all[index])
        if !found.isEmpty {
            errors = found
            errorScrollToken += 1
            return false
        }
        errors = [:]
        movingForward = true
        step = index + 1
        return true
    }

    public func back() {
        guard currentStep > 0 else { return }
        movingForward = false
        step = currentStep - 1
        errors = [:]
    }

    public func goToStep(_ index: Int) {
        let target = min(max(index, 0), stepCount - 1)
        movingForward = target >= currentStep
        step = target
    }

    // MARK: Files

    /// Add picked files to a `file_upload` field. Files the field doesn't
    /// accept are refused with a message; the rest upload on submit.
    public func addFiles(_ files: [BdPickedFile], at path: BdFieldPath) {
        guard let f = field(path.fieldId) else { return }
        var list = value(path)?.arrayValue ?? []
        let maxFiles = f.fileConfig?.maxFiles ?? 1
        var problem: String?
        for file in files {
            if list.count >= maxFiles {
                problem = message(reason: "max", label: f.label, field: f)
                break
            }
            if let p = BdFormRules.fileProblem(
                name: file.name, mimeType: file.mimeType, size: file.size,
                allowed: f.fileConfig?.allowedTypes, maxMB: f.fileConfig?.maxSize
            ) {
                problem = p
                continue
            }
            list.append(placeholder(for: file, fieldId: f.id))
        }
        setValue(.array(list), at: path)
        if let problem { errors[path.key] = problem }
    }

    public func removeFile(at index: Int, from path: BdFieldPath) {
        var list = value(path)?.arrayValue ?? []
        guard list.indices.contains(index) else { return }
        if let id = list[index]["localId"]?.stringValue { pendingFiles[id] = nil }
        list.remove(at: index)
        setValue(.array(list), at: path)
    }

    /// Set an `image_input` from a picked image; it uploads on submit.
    public func setImage(_ file: BdPickedFile, at path: BdFieldPath) {
        guard let f = field(path.fieldId) else { return }
        let cfg = f.imageInputConfig
        if let p = BdFormRules.fileProblem(
            name: file.name, mimeType: file.mimeType, size: file.size,
            allowed: cfg?.allowedTypes ?? ["image/*"], maxMB: cfg?.maxSize ?? 5
        ) {
            errors[path.key] = p
            return
        }
        setValue(placeholder(for: file, fieldId: f.id), at: path)
    }

    /// The bytes behind a pending placeholder, for a preview.
    public func pendingFile(_ value: BdJSON?) -> BdPickedFile? {
        value?["localId"]?.stringValue.flatMap { pendingFiles[$0] }
    }

    func placeholder(for file: BdPickedFile, fieldId: String) -> BdJSON {
        let id = UUID().uuidString
        pendingFiles[id] = file
        return [
            "pending": true, "localId": .string(id), "fieldId": .string(fieldId),
            "name": .string(file.name), "size": .number(Double(file.size)), "mimeType": .string(file.mimeType),
        ]
    }

    // MARK: Remote data

    public func loadCollectionOptions(_ fieldId: String) async {
        if case .loaded = collectionOptions[fieldId] { return }
        if case .loading = collectionOptions[fieldId] { return }
        guard let backend else {
            collectionOptions[fieldId] = .failed("Options can't load without a backend.")
            return
        }
        collectionOptions[fieldId] = .loading
        do {
            collectionOptions[fieldId] = .loaded(try await backend.collectionOptions(form: form, fieldId: fieldId))
        } catch {
            collectionOptions[fieldId] = .failed("Couldn't load the options.")
        }
    }

    /// Drop loaded (or failed) options and fetch them again.
    public func reloadCollectionOptions(_ fieldId: String) async {
        collectionOptions[fieldId] = nil
        await loadCollectionOptions(fieldId)
    }

    /// Open booking times for an auto-schedule field, three weeks ahead.
    public func loadScheduleSlots(_ fieldId: String, reload: Bool = false) async {
        if !reload, case .loaded = scheduleSlots[fieldId] { return }
        guard let backend else {
            scheduleSlots[fieldId] = .failed("Booking times can't load without a backend.")
            return
        }
        scheduleSlots[fieldId] = .loading
        let from = Date()
        do {
            let slots = try await backend.scheduleSlots(
                form: form, fieldId: fieldId, from: from, to: from.addingTimeInterval(21 * 86_400)
            )
            scheduleSlots[fieldId] = .loaded(slots)
        } catch {
            scheduleSlots[fieldId] = .failed("Couldn't load open times.")
        }
    }

    /// Run the app's payment handler for a `credit_card` field.
    public func collectPayment(at path: BdFieldPath) async {
        guard let f = field(path.fieldId) else { return }
        guard let backend, let paymentHandler else {
            errors[path.key] = "Card entry isn't set up in this app."
            return
        }
        do {
            let intent = try await backend.paymentIntent(form: form, fieldId: f.id)
            let intentId = try await paymentHandler(intent, f)
            setValue(.string(intentId), at: path)
            errors[path.key] = nil
        } catch {
            errors[path.key] = (error as? LocalizedError)?.errorDescription ?? "The card couldn't be saved."
        }
    }

    // MARK: Submit

    /// Validate everything, upload picked files, and submit. Never throws:
    /// every outcome, including a network failure, comes back as a result,
    /// and field-level problems land in ``errors``.
    @discardableResult
    public func submit() async -> BdSubmitResult {
        hasAttempted = true
        let found = problems(in: fields)
        if !found.isEmpty {
            return fail(.clientValidationFailed, status: 0, message: Self.summary(found.count), errors: found)
        }
        // Form-wide file cap across every file field.
        let fileFields = fieldIndex.values.filter { $0.type == "file_upload" }
        let total = fileFields.reduce(0) { $0 + (values[$1.id]?.arrayValue?.count ?? 0) }
        if total > BdFormRules.formWideMaxFiles {
            var e: [String: String] = [:]
            for f in fileFields where !(values[f.id]?.arrayValue?.isEmpty ?? true) {
                e[f.id] = "At most \(BdFormRules.formWideMaxFiles) files in total."
            }
            return fail(.clientValidationFailed, status: 0, message: "Please attach at most \(BdFormRules.formWideMaxFiles) files in total.", errors: e)
        }
        guard let backend else {
            return fail(.networkError, status: 0, message: "This form has no backend to submit to.", errors: [:])
        }

        errors = [:]
        isSubmitting = true
        defer { isSubmitting = false }

        // Upload every picked file, swapping placeholders for stored files.
        var uploadErrors: [String: String] = [:]
        values = await resolveUploads(values, prefix: "", backend: backend, errors: &uploadErrors)
        if !uploadErrors.isEmpty {
            return fail(.networkError, status: 0, message: "Some files couldn't be uploaded. Please try again.", errors: uploadErrors)
        }

        let payload = BdFormRules.toSubmissionPayload(fields, values)
        let opts = submitOptions
        let res = await backend.submit(form: form, submission: BdSubmission(
            data: payload, submitterEmail: opts.submitterEmail, submitterName: opts.submitterName,
            dryRun: opts.dryRun ? true : nil, source: opts.source, referrer: opts.referrer, metadata: opts.metadata
        ))
        result = res
        switch res {
        case .success(let ok):
            onSuccess?(ok)
        case .failure(let failure):
            errors = mapIssues(failure.issues)
            jumpToFirstError()
            onFailure?(failure)
        }
        return res
    }

    static func summary(_ count: Int) -> String {
        "Please fix the highlighted field\(count == 1 ? "" : "s")."
    }

    func fail(_ reason: BdSubmitFailure.Reason, status: Int, message: String, errors e: [String: String]) -> BdSubmitResult {
        errors = e
        let issues = e.map { key, msg in
            let id = String(key.split(separator: ".").last ?? Substring(key))
            return BdFormIssue(fieldId: id, label: field(id)?.label ?? id, reason: reason == .clientValidationFailed ? "invalid" : "upload", message: msg)
        }
        let failure = BdSubmitFailure(status: status, reason: reason, message: message, issues: issues)
        let res = BdSubmitResult.failure(failure)
        result = res
        jumpToFirstError()
        onFailure?(failure)
        return res
    }

    /// Server issues arrive by field id (or output key); map them onto
    /// field errors with readable messages.
    func mapIssues(_ issues: [BdFormIssue]) -> [String: String] {
        var keyToId: [String: String] = [:]
        for f in fieldIndex.values { if let k = f.key { keyToId[k] = f.id } }
        var out: [String: String] = [:]
        for issue in issues where !issue.fieldId.isEmpty {
            let id = fieldIndex[issue.fieldId] != nil ? issue.fieldId : (keyToId[issue.fieldId] ?? issue.fieldId)
            let f = field(id)
            out[id] = message(reason: issue.reason, label: f?.label ?? issue.label, field: f)
        }
        return out
    }

    /// In a stepped form, move to the step holding the first error.
    func jumpToFirstError() {
        errorScrollToken += 1
        guard isConsecutive, let first = errors.keys.first else { return }
        let id = String(first.split(separator: "[").first ?? Substring(first))
        let rootId = String(id.split(separator: ".").first ?? Substring(id))
        for (i, s) in steps.enumerated() where s.contains(where: { BdFormRules.fieldsById([$0])[rootId] != nil }) {
            if i != currentStep { movingForward = i > currentStep; step = i }
            return
        }
    }

    func resolveUploads(
        _ scope: [String: BdJSON],
        prefix: String,
        backend: any BdFormsBackend,
        errors: inout [String: String]
    ) async -> [String: BdJSON] {
        var out = scope
        for (key, value) in scope {
            guard let f = field(key) else { continue }
            switch f.type {
            case "file_upload":
                guard let list = value.arrayValue, list.contains(where: BdFormRules.isPendingUpload) else { continue }
                var done: [BdJSON] = []
                for item in list {
                    guard BdFormRules.isPendingUpload(item), let id = item["localId"]?.stringValue,
                          let file = pendingFiles[id] else { done.append(item); continue }
                    uploadingCount += 1
                    do {
                        done.append(try await backend.upload(form: form, fieldId: f.id, file: file).json)
                        pendingFiles[id] = nil
                    } catch {
                        errors[prefix + key] = (error as? LocalizedError)?.errorDescription ?? "Couldn't upload \(file.name)."
                        done.append(item)
                    }
                    uploadingCount -= 1
                }
                out[key] = .array(done)
            case "image_input":
                guard BdFormRules.isPendingUpload(value), let id = value["localId"]?.stringValue,
                      let file = pendingFiles[id] else { continue }
                uploadingCount += 1
                do {
                    out[key] = .string(try await backend.upload(form: form, fieldId: f.id, file: file).url)
                    pendingFiles[id] = nil
                } catch {
                    errors[prefix + key] = (error as? LocalizedError)?.errorDescription ?? "Couldn't upload \(file.name)."
                }
                uploadingCount -= 1
            case "multi_populator":
                guard let list = value.arrayValue else { continue }
                var next: [BdJSON] = []
                for (i, inst) in list.enumerated() {
                    guard let o = inst.objectValue else { next.append(inst); continue }
                    next.append(.object(await resolveUploads(o, prefix: "\(prefix)\(key)[\(i)].", backend: backend, errors: &errors)))
                }
                out[key] = .array(next)
            default:
                continue
            }
        }
        return out
    }

    /// Back to the first step with the starting values.
    public func reset() {
        guard let schema else { return }
        adopt(schema)
    }
}

extension Array {
    subscript(safe index: Int) -> Element? { indices.contains(index) ? self[index] : nil }
}
