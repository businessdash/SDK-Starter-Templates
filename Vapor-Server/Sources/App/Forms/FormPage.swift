import BdForms
import Foundation
import Vapor

/// BusinessDash forms, rendered on this server.
///
/// The same forms every BD starter renders (`<BdForm>` on the web, Swift's
/// `BdForm`, Kotlin's and Flutter's), driven by the same engine: each request
/// runs the Swift SDK's own form controller (`BdForms`, in Sources/BdForms) over
/// what the browser posted, and this file turns it into HTML. So the rules —
/// required fields, conditions, steps, calculations, the checks BD runs again
/// on submit — are the app's, not a second copy of them.
///
/// In the browser (htmx and its morph swap, loaded by `base.leaf`):
///   • a change to any field (leaving a text box, picking a choice) re-renders
///     the form, so conditional fields appear, calculations update and a box
///     marked wrong clears once it's right;
///   • Next checks the step, Back and the step dots move between steps, and
///     Submit checks everything and sends it to BD with the server's key;
///   • it all works without JavaScript too, as plain form posts.
///
/// Every step is in the page (the ones you're not on are hidden), so values
/// travel with each post and nothing is kept here between requests — except a
/// picked file, which waits in memory until Submit uploads it (like the web
/// form, an abandoned form never leaves a file behind on BD).
@MainActor
enum FormPage {
    /// The bundled sample: `/forms/demo`, and the contact section before BD is connected.
    nonisolated static let sampleSlug = "demo"

    struct Options: Sendable {
        /// Where the form posts. Default `/forms/<slug>`.
        var action: String?
        var submitLabel: String?
    }

    // MARK: - Where a form comes from

    private static var schemas: [String: (at: Date, schema: BdFormSchema)] = [:]

    static func schema(_ slug: String, bd: BdClient?) async throws -> BdFormSchema {
        if slug == sampleSlug { return try FormSamples.form() }
        guard let backend = backend(slug, bd: bd) else { throw BdFormsError(message: "BD isn't configured (BD_API_KEY / BD_SITE_ID).") }
        if let hit = schemas[slug], Date().timeIntervalSince(hit.at) < 60 { return hit.schema }
        let schema = try await backend.schema(form: slug)
        schemas[slug] = (Date(), schema)
        return schema
    }

    /// BD's Package API with this server's secret key, or the sample's stand-in.
    static func backend(_ slug: String, bd: BdClient?) -> (any BdFormsBackend)? {
        if slug == sampleSlug { return FormSamples.backend }
        guard let bd, let endpoint = URL(string: bd.baseURL) else { return nil }
        return BdPackageFormsBackend(endpoint: endpoint, headers: [
            "Authorization": "Bearer \(bd.apiKey)",
            "Origin": bd.origin,
        ])
    }

    // MARK: - Picked files, held until Submit

    private struct Held { let file: BdPickedFile; let at: Date }
    private static var held: [String: Held] = [:]

    private static func hold(_ file: BdPickedFile) -> String {
        let now = Date()
        held = held.filter { now.timeIntervalSince($0.value.at) < 3600 }
        if held.count >= 200, let oldest = held.min(by: { $0.value.at < $1.value.at }) { held[oldest.key] = nil }
        let token = UUID().uuidString
        held[token] = Held(file: file, at: now)
        return token
    }

    // MARK: - Field keys and names
    //
    // Every value-bearing field posts under `f.<key>`, where the key is its id,
    // or `<repeater key>.<row>.<child id>` inside a repeater. Composite fields
    // add a part (`f.<key>.first`). `f.<key>.~` marks a field as rendered, so
    // "nothing ticked" reads as empty rather than "not on the page".

    private static func name(_ key: String, _ part: String? = nil) -> String { "f.\(key)" + (part.map { ".\($0)" } ?? "") }

    private static func idFor(_ formId: String, _ key: String, _ part: String? = nil) -> String {
        let raw = "bd-\(formId)-\(key)" + (part.map { "-\($0)" } ?? "")
        return String(raw.map { $0.isLetter || $0.isNumber || $0 == "_" || $0 == "-" ? $0 : "-" })
    }

    private static let layoutTypes: Set<String> = ["input_group", "condition_block", "or_condition", "flex_row"]
    private static let staticTypes: Set<String> = BdFieldType.staticTypes

    /// The fields that hold a value, through layout nodes but not into repeaters.
    private static func valueFields(_ fields: [BdFormField]) -> [BdFormField] {
        fields.flatMap { field -> [BdFormField] in
            if layoutTypes.contains(field.type) { return valueFields(field.children ?? []) }
            if staticTypes.contains(field.type) || field.type == "calculation" || field.type == "reference_value" { return [] }
            return [field]
        }
    }

    // MARK: - What a request asks for

    enum Action: Equatable {
        case refresh, defaultAction, next, back, submit
        case step(Int)
        case addRow(String)
        case removeRow(String, Int)
        case removeFile(String, Int)
    }

    static func action(_ post: FormPost) -> Action {
        let raw = post.text("_action")
        switch raw {
        case "": return .refresh
        case "next": return .next
        case "back": return .back
        case "submit": return .submit
        case "default": return .defaultAction
        default: break
        }
        let parts = raw.split(separator: ":", omittingEmptySubsequences: false).map(String.init)
        switch parts.first {
        case "step": return .step(Int(parts[safe: 1] ?? "") ?? 0)
        case "add-row" where parts.count > 1: return .addRow(parts[1])
        case "remove-row" where parts.count > 1: return .removeRow(parts[1], Int(parts[safe: 2] ?? "") ?? 0)
        case "remove-file" where parts.count > 1: return .removeFile(parts[1], Int(parts[safe: 2] ?? "") ?? 0)
        default: return .refresh
        }
    }

    // MARK: - Reading a post

    /// Files to hand the controller once the values are in: picked now or held from before.
    private struct FileAdd { let path: BdFieldPath; let tokens: [String] }

    private struct Reading {
        let post: FormPost
        let action: Action
        var notices: [String] = []
        var adds: [FileAdd] = []
    }

    private static func number(_ raw: String) -> BdJSON {
        let t = raw.trimmingCharacters(in: .whitespaces)
        guard !t.isEmpty, let n = Double(t), n.isFinite else { return .null }
        return .number(n)
    }

    /// One field's value from the post, or nil when it wasn't on the page.
    private static func readValue(_ field: BdFormField, key: String, path: BdFieldPath, _ r: inout Reading) -> BdJSON? {
        let p = r.post
        guard p.has(name(key, "~")) else { return nil }
        let strings = { (list: [String]) in BdJSON.array(list.map { .string($0) }) }
        switch field.type {
        case "checkbox":
            return strings(p.texts(name(key)))
        case "boolean":
            return .bool(p.all(name(key)).contains("true"))
        case "number", "currency", "stepper":
            return number(p.text(name(key)))
        case "slider", "star_rating", "happiness_rating":
            let n = number(p.text(name(key)))
            return n.isNull ? nil : n
        case "choice_cards":
            return field.choiceConfig?.mode == "multi" ? strings(p.texts(name(key))) : .string(p.text(name(key)))
        case "collection_select":
            return field.collectionSelectConfig?.multi == true ? strings(p.texts(name(key))) : .string(p.text(name(key)))
        case "tags":
            return strings(p.text(name(key)).split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty })
        case "url":
            return .object(["url": .string(p.text(name(key)))])
        case "measurement":
            let cat = BdUnits.category(field.unitConfig?.category) ?? BdUnits.category("length")!
            let unit = p.text(name(key, "unit"))
            var o: [String: BdJSON] = ["unit": .string(unit), "baseUnit": .string(cat.baseUnit)]
            guard case .number(let n) = number(p.text(name(key, "value"))) else { return nil }
            o["value"] = .number(n)
            if let base = BdUnits.convertToBase(n, unit: unit, in: cat) { o["base"] = .number(base) }
            return .object(o)
        case "name":
            var o: [String: BdJSON] = [:]
            for part in ["prefix", "first", "middle", "last", "suffix", "nicknames"] where p.has(name(key, part)) {
                o[part] = .string(p.text(name(key, part)))
            }
            return .object(o)
        case "address":
            return .object(Dictionary(uniqueKeysWithValues: ["line1", "line2", "city", "state", "zip"].map { ($0, BdJSON.string(p.text(name(key, $0)))) }))
        case "date_range":
            return .object(["start": .string(p.text(name(key, "start"))), "end": .string(p.text(name(key, "end")))])
        case "time_picker":
            switch field.timeConfig?.mode ?? "simple" {
            case "time_block": return .object(["start": .string(p.text(name(key, "start"))), "end": .string(p.text(name(key, "end")))])
            case "appointment": return .object(["date": .string(p.text(name(key, "date"))), "time": .string(p.text(name(key, "time")))])
            default: return .string(p.text(name(key)))
            }
        case "file_upload":
            return readFiles(field, key: key, path: path, &r)
        case "multi_populator":
            var rows = (0..<max(Int(p.text(name(key, "rows"))) ?? 0, 0)).map { row -> BdJSON in
                var record: [String: BdJSON] = [:]
                for child in valueFields(field.children ?? []) {
                    let childPath = BdFieldPath(child.id, in: path.entry(row))
                    if let v = readValue(child, key: "\(key).\(row).\(child.id)", path: childPath, &r) { record[child.id] = v }
                }
                return .object(record)
            }
            let maxRows = field.populatorConfig?.maxInstances ?? 10
            if r.action == .addRow(key), rows.count < maxRows { rows.append(.object([:])) }
            if case .removeRow(key, let i) = r.action, rows.indices.contains(i), rows.count > 1 {
                rows.remove(at: i)
                r.adds.removeAll { $0.path.entries.contains { $0.repeaterId == field.id } }
            }
            return .array(rows)
        default:
            return .string(p.text(name(key)))
        }
    }

    /// A file field's list: files already stored (after a submit that failed
    /// later), files held from earlier posts, and any picked with this one.
    private static func readFiles(_ field: BdFormField, key: String, path: BdFieldPath, _ r: inout Reading) -> BdJSON {
        var kept = (try? JSONDecoder().decode([BdJSON].self, from: Data(r.post.text(name(key)).utf8))) ?? []
        if case .removeFile(key, let i) = r.action, kept.indices.contains(i) { kept.remove(at: i) }
        var stored: [BdJSON] = []
        var tokens: [String] = []
        for entry in kept {
            if entry["pending"]?.boolValue == true {
                guard let token = entry["token"]?.stringValue, held[token] != nil else {
                    r.notices.append("\(entry["name"]?.stringValue ?? "A file") waited too long; pick it again.")
                    continue
                }
                tokens.append(token)
            } else {
                stored.append(entry)
            }
        }
        for picked in r.post.files[name(key, "add")] ?? [] {
            tokens.append(hold(BdPickedFile(data: picked.data, name: picked.filename, mimeType: picked.mimeType)))
        }
        if !tokens.isEmpty { r.adds.append(FileAdd(path: path, tokens: tokens)) }
        return .array(stored)
    }

    // MARK: - Running the controller

    /// What one render needs besides the controller.
    private struct View {
        let slug: String
        let controller: BdFormController
        /// The errors to show (the controller checks everything; we show what the visitor has met).
        let errors: [String: String]
        /// Form-level messages (a failed submit, a file to pick again).
        let notices: [String]
        /// Held file tokens, by the controller's placeholder id.
        let tokens: [String: String]
        let submitLabel: String
        let action: String
        let formId: String
    }

    /// A form as it first appears.
    static func render(_ slug: String, bd: BdClient?, options: Options = Options()) async -> String {
        await run(slug, post: nil, bd: bd, options: options)
    }

    /// A post from the form: apply it, do what it asked, and render the result.
    static func handle(_ slug: String, post: FormPost, bd: BdClient?, options: Options = Options()) async -> String {
        var options = options
        let label = post.text("_label")
        if options.submitLabel == nil, !label.isEmpty { options.submitLabel = String(label.prefix(60)) }
        return await run(slug, post: post, bd: bd, options: options)
    }

    private static func run(_ slug: String, post: FormPost?, bd: BdClient?, options: Options) async -> String {
        let schema: BdFormSchema
        do {
            schema = try await self.schema(slug, bd: bd)
        } catch {
            let message = (error as? BdFormsError)?.message ?? "Could not load this form."
            return "<div class=\"bd-form\" data-bd-status=\"error\"><div class=\"bd-form__error\">\(message.html)</div></div>"
        }
        let controller = BdFormController(
            schema: schema, backend: backend(slug, bd: bd),
            submitOptions: BdSubmitOptions(source: "vapor-starter")
        )

        var reading = Reading(post: post ?? FormPost(), action: post.map(action) ?? .refresh)
        var shown = Set<String>()
        var tokens: [String: String] = [:]
        var fileErrors: [String: String] = [:]
        if let post {
            shown = Set(post.text("_errors").split(separator: ",").map(String.init))
            for field in valueFields(controller.fields) {
                guard let value = readValue(field, key: field.id, path: BdFieldPath(field.id), &reading) else { continue }
                controller.setValue(value, for: field.id)
            }
            // One at a time, so a file the field refuses is told apart.
            for add in reading.adds {
                for token in add.tokens {
                    guard let file = held[token]?.file else { continue }
                    let before = controller.value(add.path)?.arrayValue?.count ?? 0
                    controller.addFiles([file], at: add.path)
                    let list = controller.value(add.path)?.arrayValue ?? []
                    if list.count > before, let id = list.last?["localId"]?.stringValue {
                        tokens[id] = token
                    } else {
                        held[token] = nil
                    }
                }
            }
            fileErrors = controller.errors
            controller.goToStep(Int(post.text("_step")) ?? 0)
        }

        // collection_select options load here, before the render needs them.
        for field in valueFields(controller.fields) where field.type == "collection_select" {
            await controller.loadCollectionOptions(field.id)
        }

        var errors: [String: String] = [:]
        switch reading.action {
        case .back:
            controller.back()
        case .step(let index):
            if index < controller.currentStep { controller.goToStep(index) }
        case .next, .submit, .defaultAction:
            if reading.action == .next || (reading.action == .defaultAction && !controller.isLastStep && controller.isConsecutive) {
                controller.next()
                errors = controller.errors
            } else {
                let result = await controller.submit()
                errors = controller.errors
                if case .failure(let failure) = result, errors.isEmpty { reading.notices.append(failure.message) }
                if result.isSuccess {
                    for token in tokens.values { held[token] = nil }
                }
            }
        default:
            // A change: re-check only what's already marked, so a fixed box
            // clears and an untouched one isn't scolded.
            if !shown.isEmpty {
                controller.validateAll()
                errors = controller.errors.filter { shown.contains($0.key) }
            }
        }
        errors.merge(fileErrors) { current, _ in current }

        let view = View(
            slug: slug,
            controller: controller,
            errors: errors,
            notices: reading.notices,
            tokens: tokens,
            submitLabel: options.submitLabel ?? "Submit",
            action: options.action ?? "/forms/\(slug.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed.subtracting(["/"])) ?? slug)",
            formId: String(slug.map { $0.isLetter || $0.isNumber || $0 == "_" || $0 == "-" ? $0 : "-" })
        )
        return renderView(view)
    }

    // MARK: - Rendering

    /// Every type `input` draws (anything else is a plain text box).
    private static let knownTypes: Set<String> = [
        "title", "subtitle", "separator", "richtext", "body_text", "image", "textarea", "rich_text_input", "select",
        "radio", "checkbox", "boolean", "date", "email", "phone", "number", "currency", "stepper", "slider",
        "star_rating", "happiness_rating", "color_picker", "choice_cards", "date_range", "time_picker", "name",
        "address", "url", "tags", "measurement", "calculation", "collection_select", "multi_populator", "file_upload",
    ]
    private static let noLabelTypes: Set<String> = ["title", "subtitle", "separator", "richtext", "body_text", "image", "boolean"]
    /// Fields drawn as one form control, which a `<label for>` can name. The rest are groups.
    private static let singleControlTypes: Set<String> = [
        "text", "textarea", "rich_text_input", "select", "date", "email", "phone", "number", "currency",
        "stepper", "slider", "url", "tags", "measurement",
    ]

    private static func singleControl(_ field: BdFormField) -> Bool {
        if field.type == "time_picker" { return (field.timeConfig?.mode ?? "simple") == "simple" }
        return singleControlTypes.contains(field.type) || !knownTypes.contains(field.type)
    }

    private static func renderView(_ v: View) -> String {
        let c = v.controller
        let formId = v.formId

        if c.isSubmitted {
            let sample = v.slug == sampleSlug
                ? "<p class=\"bd-form__success-note\">This is the bundled sample, so nothing was sent.</p>" : ""
            return """
            <div class="bd-form" id="bd-form-\(formId)" data-bd-status="submitted">
              <div class="bd-form__success" role="status">
                <p class="bd-form__success-title">Thanks — we got it.</p>
                \(sample)
                <a class="bd-btn bd-btn--ghost" href="\(v.action.html)">Fill it in again</a>
              </div>
            </div>
            """
        }

        let stepped = c.isConsecutive && c.stepCount > 1
        let errorKeys = ordered(v.errors.keys, in: c.fields)
        let labels = errorKeys.compactMap { key -> String? in
            let id = String(key.split(separator: ".").last ?? Substring(key))
            let label = c.field(id)?.label ?? ""
            return label.isEmpty ? nil : label
        }
        let header = (c.schema?.title ?? "").isEmpty && (c.schema?.description ?? "").isEmpty ? "" : """
            <div class="bd-form__header">
              \(c.schema?.title.map { "<h2 class=\"bd-form__title\">\($0.html)</h2>" } ?? "")
              \(c.schema?.description.map { "<p class=\"bd-form__description\">\($0.html)</p>" } ?? "")
            </div>
            """
        let summary = labels.isEmpty ? "" : """
            <div class="bd-form__error-summary" role="alert">
              <div class="bd-form__error-summary-title">Please complete the highlighted field\(labels.count == 1 ? "" : "s").</div>
              <div class="bd-form__error-summary-list">\(labels.joined(separator: ", ").html)</div>
            </div>
            """
        let body = stepped
            ? c.steps.enumerated().map { i, step in
                "<div class=\"bd-step\" data-bd-step=\"\(i)\"\(flag(i != c.currentStep, "hidden"))>\(tree(step, v, prefix: "", entries: [], flat: true))</div>"
            }.joined()
            : tree(c.fields, v, prefix: "", entries: [], flat: false)
        let action = v.action.html

        // The form posts its buttons; the div inside posts each change. Two
        // elements because htmx remembers the last button clicked on a form and
        // sends its value with that form's later posts — the morph swap keeps
        // the button, so a change after "Add a row" would add another. The div's
        // posts never carry it. Both swap into the form and share one queue,
        // where a newer post cancels an older one still on its way.
        return """
        <form class="bd-form" id="bd-form-\(formId)" data-bd-status="\(c.isSubmitting ? "submitting" : "idle")"
          method="post" action="\(action)" enctype="multipart/form-data" novalidate
          hx-post="\(action)" hx-encoding="multipart/form-data" hx-trigger="submit" hx-target="this"
          hx-ext="morph" hx-swap="morph:{ignoreActiveValue:true}" hx-sync="this:replace">
          <button class="bd-form__default" type="submit" name="_action" value="default" tabindex="-1" aria-hidden="true">Continue</button>
          <input type="hidden" name="_step" value="\(c.currentStep)" />
          <input type="hidden" name="_errors" value="\(errorKeys.joined(separator: ",").html)" />
          <input type="hidden" name="_label" value="\(v.submitLabel.html)" />
          <div class="bd-form__live" hx-post="\(action)" hx-trigger="change" hx-target="closest form" hx-sync="closest form:replace">
          \(c.schema?.orgIcon.map { "<img class=\"bd-form__org-icon\" src=\"\($0.html)\" alt=\"\" />" } ?? "")
          \(header)
          \(stepped ? progress(c) : "")
          \(v.notices.map { "<div class=\"bd-form__error\" role=\"alert\">\($0.html)</div>" }.joined())
          \(summary)
          \(body)
          \(nav(v, stepped: stepped))
          </div>
        </form>
        """
    }

    /// Error keys in the order their fields appear.
    private static func ordered(_ keys: Dictionary<String, String>.Keys, in fields: [BdFormField]) -> [String] {
        var order: [String: Int] = [:]
        func walk(_ nodes: [BdFormField]) {
            for node in nodes {
                if order[node.id] == nil { order[node.id] = order.count }
                walk(node.children ?? [])
            }
        }
        walk(fields)
        let root = { (key: String) in String(key.split(separator: "[").first ?? Substring(key)) }
        return keys.sorted { (order[root($0)] ?? .max, $0) < (order[root($1)] ?? .max, $1) }
    }

    private static func progress(_ c: BdFormController) -> String {
        guard c.settings.showProgress == true else { return "" }
        if c.settings.progressStyle == "bar" {
            return """
            <div class="bd-progress bd-progress--bar">
              <span class="bd-progress__count">\(c.currentStep + 1) / \(c.stepCount)</span>
              <div class="bd-progress__track"><div class="bd-progress__fill" style="width:\(Int((c.progress * 100).rounded()))%"></div></div>
            </div>
            """
        }
        let steps = (0..<c.stepCount).map { i -> String in
            let done = i < c.currentStep
            let current = i == c.currentStep
            let line = i > 0 ? "<div class=\"\(classes("bd-progress__line", i <= c.currentStep ? "bd-progress__line--done" : nil))\"></div>" : ""
            return line + """
            <button class="\(classes("bd-progress__step", current ? "bd-progress__step--current" : nil, done ? "bd-progress__step--done" : nil))" \
            type="submit" name="_action" value="step:\(i)"\(flag(!done, "disabled"))\(current ? " aria-current=\"step\"" : "")>\
            <span class="\(classes("bd-progress__dot", current ? "bd-progress__dot--current" : nil, done ? "bd-progress__dot--done" : nil))">\(done ? "✓" : String(i + 1))</span>\
            <span class="bd-progress__title">\(c.stepTitle(i).html)</span></button>
            """
        }
        return "<div class=\"bd-progress bd-progress--steps\"><div class=\"bd-progress__steps\">\(steps.joined())</div></div>"
    }

    private static func nav(_ v: View, stepped: Bool) -> String {
        let c = v.controller
        let primary = stepped && !c.isLastStep
            ? "<button class=\"bd-btn bd-btn--next\" type=\"submit\" name=\"_action\" value=\"next\">Next</button>"
            : "<button class=\"bd-btn bd-btn--submit\" type=\"submit\" name=\"_action\" value=\"submit\"><span class=\"bd-btn__label\">\(v.submitLabel.html)</span><span class=\"bd-btn__busy\">Sending…</span></button>"
        let back = stepped
            ? "<button class=\"bd-btn bd-btn--ghost bd-btn--back\" type=\"submit\" name=\"_action\" value=\"back\"\(flag(c.isFirstStep, "disabled"))>Back</button>"
            : ""
        return "<div class=\"bd-nav\">\(back)\(primary)</div>"
    }

    /// The field tree. `prefix` is the repeater row's key prefix ("" at the top).
    private static func tree(_ fields: [BdFormField], _ v: View, prefix: String, entries: [BdFieldPath.Entry], flat: Bool) -> String {
        let c = v.controller
        let out = fields.map { field -> String in
            switch field.type {
            case "input_group":
                let kids = field.children ?? []
                let count = c.revealCount(field, in: entries)
                let label = field.showGroupLabel == true && !field.label.isEmpty ? "<div class=\"bd-group__label\">\(field.label.html)</div>" : ""
                let rest = count < kids.count ? "<div hidden>\(tree(Array(kids[count...]), v, prefix: prefix, entries: entries, flat: flat))</div>" : ""
                return """
                <div class="\(classes("bd-group", flat ? "bd-group--flat" : "bd-group--card"))" data-bd-group="\(cssKey(field).html)"\(flag(!c.isVisible(field, in: entries), "hidden"))>\
                \(label)\(tree(Array(kids.prefix(count)), v, prefix: prefix, entries: entries, flat: flat))\(rest)</div>
                """
            case "condition_block":
                // Hidden, not dropped: what's typed there comes back if the condition does.
                return "<div class=\"bd-condition\"\(flag(!c.isVisible(field, in: entries), "hidden"))>\(tree(field.children ?? [], v, prefix: prefix, entries: entries, flat: flat))</div>"
            case "or_condition":
                let kids = field.children ?? []
                let error = v.errors[BdFieldPath(field.id, in: entries).key]
                let side = { (node: BdFormField?, label: String) in
                    "<div class=\"bd-or__side\"><div class=\"bd-or__side-label\">\(label.html)</div>\(node.map { tree([$0], v, prefix: prefix, entries: entries, flat: flat) } ?? "")</div>"
                }
                return """
                <div class="\(classes("bd-or", error != nil ? "bd-or--error" : nil))">
                \(field.label.isEmpty ? "" : "<div class=\"bd-or__label\">\(field.label.html)<span class=\"bd-or__hint\"> Fill at least one side</span></div>")
                <div class="bd-or__grid">\(side(kids[safe: 0], field.orConditionConfig?.leftLabel ?? "Option A"))<div class="bd-or__divider"><span class="bd-or__badge">OR</span></div>\(side(kids[safe: 1], field.orConditionConfig?.rightLabel ?? "Option B"))</div>
                \(error.map { "<p class=\"bd-or__error\">\($0.html)</p>" } ?? "")
                </div>
                """
            case "flex_row":
                return "<div class=\"bd-flex-row\">\((field.children ?? []).map { "<div class=\"bd-flex-row__cell\">\(tree([$0], v, prefix: prefix, entries: entries, flat: flat))</div>" }.joined())</div>"
            case "reference_value":
                return ""
            default:
                return row(field, v, prefix: prefix, entries: entries)
            }
        }
        return "<div class=\"bd-tree\">\(out.joined())</div>"
    }

    private static func cssKey(_ field: BdFormField) -> String {
        let explicit = [field.outputKey, field.key].compactMap { $0?.trimmingCharacters(in: .whitespaces) }.first { !$0.isEmpty }
        return explicit ?? field.id
    }

    private static func row(_ field: BdFormField, _ v: View, prefix: String, entries: [BdFieldPath.Entry]) -> String {
        let key = prefix + field.id
        let path = BdFieldPath(field.id, in: entries)
        let error = v.errors[path.key]
        let inputId = idFor(v.formId, key)
        let showLabel = !noLabelTypes.contains(field.type) && !field.label.isEmpty
        let valueBearing = !staticTypes.contains(field.type) && field.type != "calculation"
        let helpId = field.helpText.map { _ in "\(inputId)-help" }
        let errorId = error.map { _ in "\(inputId)-error" }
        let describedBy = [errorId, helpId].compactMap { $0 }.joined(separator: " ")
        let labelId = "\(inputId)-label"
        let single = singleControl(field)
        let required = field.required ? "<span class=\"bd-field__required\" aria-hidden=\"true\"> *</span>" : ""
        let label = !showLabel ? ""
            : single ? "<label class=\"bd-field__label\" id=\"\(labelId)\" for=\"\(inputId)\">\(field.label.html)\(required)</label>"
            : "<span class=\"bd-field__label\" id=\"\(labelId)\">\(field.label.html)\(required)</span>"
        let control = input(
            field, v, key: key, path: path, value: v.controller.value(path), id: inputId,
            describedBy: describedBy, invalid: error != nil, labelledBy: showLabel && !single ? labelId : nil
        )
        return """
        <div class="\(classes("bd-field", "bd-field--\(field.type)", field.required ? "bd-field--required" : nil, error != nil ? "bd-field--error" : nil))" \
        data-field-id="\(field.id.html)" data-bd-field="\(cssKey(field).html)" data-bd-type="\(field.type.html)">\
        \(label)\(valueBearing ? "<input type=\"hidden\" name=\"\(name(key, "~").html)\" value=\"1\" />" : "")\(control)\
        \(error.map { "<p class=\"bd-field__error\" id=\"\(errorId!)\">\($0.html)</p>" } ?? "")\
        \(field.helpText.map { "<p class=\"bd-field__help\" id=\"\(helpId!)\">\($0.html)</p>" } ?? "")</div>
        """
    }

    // MARK: Controls

    private static func str(_ value: BdJSON?) -> String {
        switch value {
        case .string(let s)?: return s
        case .number(let n)?: return BdJS.string(.number(n))
        default: return ""
        }
    }

    private static let autocompleteTokens: [(String, String)] = [
        (#"first[\s_-]?name|given[\s_-]?name"#, "given-name"),
        (#"last[\s_-]?name|family[\s_-]?name|surname"#, "family-name"),
        (#"full[\s_-]?name|your[\s_-]?name|^name$|contact[\s_-]?name"#, "name"),
        (#"company|organi[sz]ation|business[\s_-]?name|employer"#, "organization"),
        (#"job[\s_-]?title|position|occupation"#, "organization-title"),
        (#"web[\s_-]?site|homepage|\burl\b"#, "url"),
        (#"address[\s_-]?line[\s_-]?2|apartment|\bapt\b|\bsuite\b|\bunit\b"#, "address-line2"),
        (#"street|address[\s_-]?line[\s_-]?1|^address1?$|street[\s_-]?address"#, "street-address"),
        (#"\bcity\b|\btown\b"#, "address-level2"),
        (#"\bstate\b|province|region"#, "address-level1"),
        (#"\bzip\b|postal|post[\s_-]?code"#, "postal-code"),
        (#"\bcountry\b"#, "country-name"),
        (#"birth|\bdob\b"#, "bday"),
        (#"work[\s_-]?phone|office[\s_-]?phone|company[\s_-]?phone|mobile|cell"#, "tel"),
    ]

    /// The browser's autofill hint: the field's own, else one read from its type, key and label (as the SDK does).
    private static func autocomplete(_ field: BdFormField) -> String {
        if let own = field.autocomplete, !own.isEmpty { return " autocomplete=\"\(own.html)\"" }
        let token: String? = switch field.type {
        case "email": "email"
        case "phone": "tel"
        case "url": "url"
        default: {
            let haystack = "\(field.key ?? "") \(field.label)"
            return autocompleteTokens.first { haystack.range(of: $0.0, options: [.regularExpression, .caseInsensitive]) != nil }?.1
        }()
        }
        return token.map { " autocomplete=\"\($0)\"" } ?? ""
    }

    private static func input(
        _ field: BdFormField, _ v: View, key: String, path: BdFieldPath, value: BdJSON?, id: String,
        describedBy: String, invalid: Bool, labelledBy: String?
    ) -> String {
        let aria = (describedBy.isEmpty ? "" : " aria-describedby=\"\(describedBy)\"") + (invalid ? " aria-invalid=\"true\"" : "")
        // On a group's container: what names it.
        let group = labelledBy.map { " aria-labelledby=\"\($0)\"" } ?? ""
        let n = name(key).html
        let placeholder = (field.placeholder ?? "").html
        switch field.type {
        case "title":
            return "<h2 class=\"bd-field__title\">\(field.label.html)</h2>"
        case "subtitle":
            return "<h3 class=\"bd-field__subtitle\">\(field.label.html)</h3>"
        case "separator":
            return "<hr class=\"bd-field__separator\" />"
        case "richtext", "body_text":
            // BD publishes `content` already sanitized.
            return field.content.map { "<div class=\"bd-field__richtext bd-prose\">\($0)</div>" } ?? ""
        case "image":
            guard let src = field.imageConfig?.src, !src.isEmpty else { return "" }
            return "<img class=\"bd-field__image\" src=\"\(src.html)\" alt=\"\((field.imageConfig?.alt ?? "").html)\" />"
        case "textarea", "rich_text_input":
            return "<textarea class=\"bd-textarea\" id=\"\(id)\" name=\"\(n)\" rows=\"\(field.textareaConfig?.rows ?? 4)\" placeholder=\"\(placeholder)\"\(autocomplete(field))\(aria)>\(str(value).html)</textarea>"
        case "select":
            let options = (field.options ?? []).map { "<option value=\"\($0.html)\"\(flag(str(value) == $0, "selected"))>\($0.html)</option>" }.joined()
            return "<select class=\"bd-select\" id=\"\(id)\" name=\"\(n)\"\(aria)><option value=\"\">\((field.placeholder ?? "Select…").html)</option>\(options)</select>"
        case "radio":
            return choices(field.options ?? [], type: "radio", n: n, id: id, aria: aria + group) { str(value) == $0 }
        case "checkbox":
            let picked = (value?.arrayValue ?? []).map { str($0) }
            return choices(field.options ?? [], type: "checkbox", n: n, id: id, aria: aria + group) { picked.contains($0) }
        case "boolean":
            let required = field.required || field.mustBeTrue == true ? "<span class=\"bd-field__required\" aria-hidden=\"true\"> *</span>" : ""
            return """
            <label class="bd-boolean" for="\(id)"><input type="hidden" name="\(n)" value="false" />\
            <input class="bd-switch" type="checkbox" id="\(id)" name="\(n)" value="true"\(flag(value == .bool(true), "checked"))\(aria) />\
            <span class="bd-boolean__label">\((field.placeholder ?? (field.label.isEmpty ? "Yes" : field.label)).html)\(required)</span></label>
            """
        case "date":
            return "<input class=\"bd-input\" type=\"date\" id=\"\(id)\" name=\"\(n)\" value=\"\(str(value).html)\"\(aria) />"
        case "email":
            return "<input class=\"bd-input\" type=\"email\" id=\"\(id)\" name=\"\(n)\" value=\"\(str(value).html)\" placeholder=\"\((field.placeholder ?? "you@example.com").html)\"\(autocomplete(field))\(aria) />"
        case "phone":
            let intl = field.phoneConfig?.international == true
            let flagMark = field.phoneConfig?.showFlags == true ? "<span class=\"bd-phone__flag\" aria-hidden=\"true\">🇺🇸</span>" : ""
            return "<div class=\"bd-phone\">\(flagMark)<input class=\"bd-input\" type=\"tel\" id=\"\(id)\" name=\"\(n)\" value=\"\(str(value).html)\" placeholder=\"\((field.placeholder ?? (intl ? "+1 (555) 000-0000" : "(555) 000-0000")).html)\"\(autocomplete(field))\(aria) /></div>"
        case "number", "currency", "stepper":
            let decimals = field.allowDecimal != false && field.type != "stepper"
            let min = field.validation?.min.map { " min=\"\(BdJS.string(.number($0)))\"" } ?? (field.allowNegative == false ? " min=\"0\"" : "")
            let max = field.validation?.max.map { " max=\"\(BdJS.string(.number($0)))\"" } ?? ""
            return "<input class=\"bd-input\" type=\"number\" id=\"\(id)\" name=\"\(n)\" value=\"\(str(value).html)\" placeholder=\"\(placeholder)\"\(min)\(max) step=\"\(decimals ? "any" : "1")\" inputmode=\"\(decimals ? "decimal" : "numeric")\"\(aria) />"
        case "slider":
            let lo = field.sliderConfig?.min ?? 0
            let hi = field.sliderConfig?.max ?? 100
            let step = field.sliderConfig?.step ?? 1
            let unit = field.sliderConfig?.unit
            let fmt = { (x: Double) -> String in
                let s = BdJS.string(.number(x))
                return unit == "currency" ? "$\(s)" : unit == "percent" ? "\(s)%" : s
            }
            let current = value?.doubleValue ?? lo
            return """
            <div class="bd-slider-wrap"><div class="bd-slider__scale"><span>\(fmt(lo))</span><output class="bd-slider__value" for="\(id)">\(fmt(current))</output><span>\(fmt(hi))</span></div>\
            <input class="bd-slider" type="range" id="\(id)" name="\(n)" min="\(BdJS.string(.number(lo)))" max="\(BdJS.string(.number(hi)))" step="\(BdJS.string(.number(step)))" value="\(BdJS.string(.number(current)))"\(aria) /></div>
            """
        case "star_rating":
            let most = field.starRatingConfig?.maxStars ?? 5
            let current = Int(value?.doubleValue ?? 0)
            let stars = (0..<most).map { i in
                "<label class=\"\(classes("bd-star", i < current ? "bd-star--filled" : nil))\"><input class=\"bd-visually-hidden\" type=\"radio\" name=\"\(n)\" value=\"\(i + 1)\"\(flag(current == i + 1, "checked")) /><span aria-hidden=\"true\">★</span><span class=\"bd-visually-hidden\">\(i + 1) star\(i == 0 ? "" : "s")</span></label>"
            }.joined()
            return "<div class=\"bd-stars\" role=\"radiogroup\" id=\"\(id)\"\(aria)\(group)>\(stars)</div>"
        case "happiness_rating":
            let current = Int(value?.doubleValue ?? -1)
            let faces = [("😞", "Very unhappy"), ("😕", "Unhappy"), ("😐", "Neutral"), ("🙂", "Happy"), ("😄", "Very happy")]
            let items = faces.enumerated().map { i, face in
                "<label class=\"\(classes("bd-happiness__face", i == current ? "bd-happiness__face--active" : nil))\" title=\"\(face.1)\"><input class=\"bd-visually-hidden\" type=\"radio\" name=\"\(n)\" value=\"\(i)\"\(flag(current == i, "checked")) /><span aria-hidden=\"true\">\(face.0)</span><span class=\"bd-visually-hidden\">\(face.1)</span></label>"
            }.joined()
            return "<div class=\"bd-happiness\" role=\"radiogroup\" id=\"\(id)\"\(aria)\(group)>\(items)</div>"
        case "color_picker":
            let items = (field.options ?? []).map { color in
                "<label class=\"\(classes("bd-color", str(value) == color ? "bd-color--selected" : nil))\" style=\"background-color:\(color.html)\" title=\"\(color.html)\"><input class=\"bd-visually-hidden\" type=\"radio\" name=\"\(n)\" value=\"\(color.html)\"\(flag(str(value) == color, "checked")) /><span class=\"bd-visually-hidden\">\(color.html)</span></label>"
            }.joined()
            return "<div class=\"bd-colors\" role=\"radiogroup\" id=\"\(id)\"\(aria)\(group)>\(items)</div>"
        case "choice_cards":
            let multi = field.choiceConfig?.mode == "multi"
            let picked = multi ? (value?.arrayValue ?? []).map { str($0) } : [str(value)]
            let cards = (field.choiceConfig?.options ?? []).enumerated().map { i, o in
                let on = picked.contains(o.label)
                return """
                <label class="\(classes("bd-card-choice", on ? "bd-card-choice--on" : nil))" for="\(id)-\(i)">\
                <input class="bd-card-choice__input" type="\(multi ? "checkbox" : "radio")" id="\(id)-\(i)" name="\(n)" value="\(o.label.html)"\(flag(on, "checked")) />\
                \(o.imageUrl.map { "<img class=\"bd-card-choice__image\" src=\"\($0.html)\" alt=\"\" />" } ?? "")\
                <span class="bd-card-choice__label">\(o.label.html)</span>\
                \(o.description.map { "<span class=\"bd-card-choice__description\">\($0.html)</span>" } ?? "")\
                \(o.price.map { "<span class=\"bd-card-choice__price\">\($0.html)</span>" } ?? "")</label>
                """
            }.joined()
            return "<div class=\"bd-cards\" role=\"\(multi ? "group" : "radiogroup")\" id=\"\(id)\"\(aria)\(group)>\(cards)</div>"
        case "date_range":
            return pair(id: id, n: n, group: group, ("start", "Start", "date", str(value?["start"])), ("end", "End", "date", str(value?["end"])))
        case "time_picker":
            switch field.timeConfig?.mode ?? "simple" {
            case "time_block":
                return pair(id: id, n: n, group: group, ("start", "Start", "time", str(value?["start"])), ("end", "End", "time", str(value?["end"])))
            case "appointment":
                return pair(id: id, n: n, group: group, ("date", "Date", "date", str(value?["date"])), ("time", "Time", "time", str(value?["time"])))
            default:
                let h24 = field.timeConfig?.format == "24h"
                let step = max(field.timeConfig?.stepMinutes ?? 30, 1)
                var options = ""
                for hour in 0..<24 {
                    for minute in stride(from: 0, to: 60, by: step) {
                        let t = String(format: "%02d:%02d", hour, minute)
                        let label = h24 ? t : "\(hour % 12 == 0 ? 12 : hour % 12):\(String(format: "%02d", minute)) \(hour < 12 ? "AM" : "PM")"
                        options += "<option value=\"\(t)\"\(flag(str(value) == t, "selected"))>\(label)</option>"
                    }
                }
                return "<select class=\"bd-select\" id=\"\(id)\" name=\"\(n)\"\(aria)><option value=\"\">\((field.placeholder ?? "Select time").html)</option>\(options)</select>"
            }
        case "name":
            let cfg = field.nameConfig
            let part = { (p: String, label: String, token: String, hint: String, full: Bool) in
                "<label class=\"\(classes("bd-name__field", full ? "bd-name__field--full" : nil))\"><span class=\"bd-name__label\">\(label)</span><input class=\"bd-input\" id=\"\(idFor(v.formId, key, p))\" name=\"\(name(key, p).html)\" value=\"\(str(value?[p]).html)\" placeholder=\"\(hint)\" autocomplete=\"\(token)\"\(aria) /></label>"
            }
            let middle = cfg?.middle == true
            let suffix = cfg?.suffix == true
            return """
            <div class="bd-name" role="group" id="\(id)"\(group)>\
            \(cfg?.prefix == true ? part("prefix", "Title", "honorific-prefix", "Dr.", true) : "")\
            \(part("first", "First name", "given-name", "Jane", false))\
            \(middle ? part("middle", "Middle name", "additional-name", "Quinn", false) : "")\
            \(part("last", "Last name", "family-name", "Doe", middle && !suffix))\
            \(suffix ? part("suffix", "Suffix", "honorific-suffix", "Jr.", !middle) : "")\
            \(cfg?.nicknames == true ? "<label class=\"bd-name__field bd-name__field--full\"><span class=\"bd-name__label\">Nicknames</span><input class=\"bd-input\" name=\"\(name(key, "nicknames").html)\" value=\"\(str(value?["nicknames"]).html)\" placeholder=\"Johnny, JM — separate with commas\" /></label>" : "")</div>
            """
        case "address":
            let part = { (p: String, label: String, token: String, full: Bool) in
                "<label class=\"\(classes("bd-address__field", full ? "bd-address__field--full" : nil))\"><span class=\"bd-address__label\">\(label)</span><input class=\"bd-input\" id=\"\(idFor(v.formId, key, p))\" name=\"\(name(key, p).html)\" value=\"\(str(value?[p]).html)\" autocomplete=\"\(token)\"\(aria) /></label>"
            }
            return """
            <div class="bd-address" role="group" id="\(id)"\(group)>\(part("line1", "Address line 1", "address-line1", true))\(part("line2", "Address line 2", "address-line2", true))\
            \(part("city", "City", "address-level2", false))\(part("state", "State", "address-level1", false))\(part("zip", "ZIP", "postal-code", true))</div>
            """
        case "url":
            return "<input class=\"bd-input\" type=\"url\" id=\"\(id)\" name=\"\(n)\" value=\"\(str(value?["url"]).html)\" placeholder=\"\((field.placeholder ?? "https://").html)\"\(aria) />"
        case "tags":
            let tags = (value?.arrayValue ?? []).map { str($0) }.joined(separator: ", ")
            return "<input class=\"bd-input\" id=\"\(id)\" name=\"\(n)\" value=\"\(tags.html)\" placeholder=\"\((field.placeholder ?? "Separate with commas").html)\"\(aria) />"
        case "measurement":
            let cat = BdUnits.category(field.unitConfig?.category) ?? BdUnits.category("length")!
            let units = field.unitConfig?.units?.isEmpty == false ? field.unitConfig!.units! : cat.units.map(\.symbol)
            let unit = value?["unit"]?.stringValue ?? field.unitConfig?.defaultUnit ?? units.first ?? cat.baseUnit
            let picker = field.unitConfig?.mode == "fixed" || units.count <= 1
                ? "<input type=\"hidden\" name=\"\(name(key, "unit").html)\" value=\"\(unit.html)\" /><span class=\"bd-measurement__unit\">\(unit.html)</span>"
                : "<select class=\"bd-select\" name=\"\(name(key, "unit").html)\" aria-label=\"Unit\">\(units.map { "<option value=\"\($0.html)\"\(flag($0 == unit, "selected"))>\($0.html)</option>" }.joined())</select>"
            return "<div class=\"bd-measurement\"><input class=\"bd-input\" type=\"number\" step=\"any\" id=\"\(id)\" name=\"\(name(key, "value").html)\" value=\"\(str(value?["value"]).html)\"\(aria) />\(picker)</div>"
        case "calculation":
            let display = field.calculationConfig?.display
            if display?.show == false { return "" }
            let shown = BdCalculation.format(value, display: display)
            return "<output class=\"bd-calc\" id=\"\(id)\" aria-live=\"polite\">\((shown.isEmpty ? "—" : shown).html)</output>"
        case "collection_select":
            return collectionSelect(field, v, n: n, id: id, value: value, aria: aria, group: group)
        case "multi_populator":
            return "<div role=\"group\"\(group)>\(repeater(field, v, key: key, path: path, value: value))</div>"
        case "file_upload":
            return files(field, v, key: key, value: value, id: id, aria: aria, labelledBy: labelledBy)
        case "schedule", "signature", "payment", "credit_card", "icon_picker", "image_input", "month_year":
            return "<p class=\"bd-field__unsupported\">\((field.label.isEmpty ? "This field" : field.label).html) can't be filled in on this page yet.</p>"
        default:
            return "<input class=\"bd-input\" type=\"text\" id=\"\(id)\" name=\"\(n)\" value=\"\(str(value).html)\" placeholder=\"\(placeholder)\"\(autocomplete(field))\(aria) />"
        }
    }

    private static func choices(_ options: [String], type: String, n: String, id: String, aria: String, on: (String) -> Bool) -> String {
        let radio = type == "radio"
        let items = options.enumerated().map { i, o in
            "<label class=\"\(radio ? "bd-radio-option" : "bd-checkbox-option")\" for=\"\(id)-\(i)\"><input class=\"\(radio ? "bd-radio" : "bd-checkbox")\" type=\"\(type)\" id=\"\(id)-\(i)\" name=\"\(n)\" value=\"\(o.html)\"\(flag(on(o), "checked")) /><span>\(o.html)</span></label>"
        }.joined()
        return "<div class=\"\(radio ? "bd-radio-group" : "bd-checkbox-group")\" role=\"\(radio ? "radiogroup" : "group")\" id=\"\(id)\"\(aria)>\(items)</div>"
    }

    private static func pair(id: String, n: String, group: String, _ left: (String, String, String, String), _ right: (String, String, String, String)) -> String {
        let cell = { (c: (String, String, String, String)) in
            "<label class=\"bd-grid__cell\"><span class=\"bd-grid__label\">\(c.1)</span><input class=\"bd-input\" type=\"\(c.2)\" id=\"\(id)-\(c.0)\" name=\"\(n).\(c.0)\" value=\"\(c.3.html)\" /></label>"
        }
        return "<div class=\"bd-grid bd-grid--2\" role=\"group\" id=\"\(id)\"\(group)>\(cell(left))\(cell(right))</div>"
    }

    private static func collectionSelect(_ field: BdFormField, _ v: View, n: String, id: String, value: BdJSON?, aria: String, group: String) -> String {
        let state = v.controller.collectionOptions[field.id] ?? .idle
        guard case .loaded(let options) = state, !options.isEmpty else {
            let (status, message) = switch state {
            case .loaded: ("empty", "Nothing to choose from yet.")
            case .failed(let why): ("error", why)
            default: ("loading", "Loading the choices…")
            }
            return "<div class=\"bd-field__collection\" data-status=\"\(status)\"><p class=\"bd-field__collection-status\" role=\"\(status == "empty" ? "status" : "alert")\">\(message.html)</p></div>"
        }
        let multi = field.collectionSelectConfig?.multi == true
        let searchable = field.display == "combobox" || options.count > 10
        let images = options.contains { !($0.image ?? "").trimmingCharacters(in: .whitespaces).isEmpty }
        if !multi, !searchable, !images {
            let items = options.map { "<option value=\"\($0.value.html)\"\(flag(str(value) == $0.value, "selected"))>\($0.label.html)</option>" }.joined()
            return "<div class=\"bd-field__collection\" data-status=\"ready\"><select class=\"bd-select bd-field__collection-select\" id=\"\(id)\" name=\"\(n)\"\(aria)><option value=\"\">\((field.placeholder ?? "Choose…").html)</option>\(items)</select></div>"
        }
        let picked = multi ? (value?.arrayValue ?? []).map { str($0) } : [str(value)].filter { !$0.isEmpty }
        let items = options.enumerated().map { i, o in
            let on = picked.contains(o.value)
            return "<label class=\"bd-field__collection-option\"\(on ? " data-selected=\"true\"" : "") for=\"\(id)-\(i)\"><input type=\"\(multi ? "checkbox" : "radio")\" id=\"\(id)-\(i)\" name=\"\(n)\" value=\"\(o.value.html)\"\(flag(on, "checked")) /><span class=\"bd-field__collection-label\">\(o.label.html)</span></label>"
        }.joined()
        return "<div class=\"bd-field__collection\" data-status=\"ready\"><div class=\"bd-field__collection-options\" role=\"\(multi ? "group" : "radiogroup")\" id=\"\(id)\"\(aria)\(group)>\(items)</div></div>"
    }

    private static func repeater(_ field: BdFormField, _ v: View, key: String, path: BdFieldPath, value: BdJSON?) -> String {
        let cfg = field.populatorConfig
        let most = cfg?.maxInstances ?? 10
        let least = max(cfg?.minInstances ?? 1, 1)
        let rows = value?.arrayValue ?? []
        let count = max(rows.count, least)
        let item = cfg?.itemLabel ?? "Item"
        let fieldsets = (0..<count).map { row in
            """
            <fieldset class="bd-repeater__row"><legend class="bd-repeater__legend">\(item.html) \(row + 1)</legend>\
            \(tree(field.children ?? [], v, prefix: "\(key).\(row).", entries: path.entry(row), flat: true))\
            \(count > least ? "<button class=\"bd-btn bd-btn--ghost bd-btn--sm bd-repeater__remove\" type=\"submit\" name=\"_action\" value=\"remove-row:\(key.html):\(row)\">Remove \(item.lowercased().html) \(row + 1)</button>" : "")</fieldset>
            """
        }.joined()
        let add = count < most
            ? "<button class=\"bd-btn bd-btn--ghost bd-repeater__add\" type=\"submit\" name=\"_action\" value=\"add-row:\(key.html)\">\((cfg?.addButtonLabel ?? "Add \(item.lowercased())").html)</button>"
            : ""
        return "<div class=\"bd-repeater\"><input type=\"hidden\" name=\"\(name(key, "rows").html)\" value=\"\(count)\" />\(fieldsets)\(add)</div>"
    }

    private static func files(_ field: BdFormField, _ v: View, key: String, value: BdJSON?, id: String, aria: String, labelledBy: String?) -> String {
        let list = value?.arrayValue ?? []
        let most = field.fileConfig?.maxFiles ?? 1
        let allowed = field.fileConfig?.allowedTypes ?? []
        // What the next post sends back: stored files as they are, held ones by token.
        let kept: [BdJSON] = list.map { entry in
            guard entry["pending"]?.boolValue == true else { return entry }
            return .object([
                "pending": .bool(true),
                "token": .string(entry["localId"]?.stringValue.flatMap { v.tokens[$0] } ?? ""),
                "name": entry["name"] ?? .string("file"),
                "size": entry["size"] ?? .number(0),
            ])
        }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        let keptJSON = (try? encoder.encode(kept)).map { String(decoding: $0, as: UTF8.self) } ?? "[]"
        let remaining = max(most - list.count, 0)
        // A new picker on every render: a picked file is held here once it's
        // posted, and the morph swap would otherwise keep it in the old picker
        // and send it again with the next post.
        let pickerId = "\(id)-\(UUID().uuidString.prefix(8).lowercased())"
        let named = labelledBy.map { " aria-labelledby=\"\($0) \(pickerId)-text\"" } ?? ""
        let grouped = labelledBy.map { " aria-labelledby=\"\($0)\"" } ?? ""
        let picker = remaining > 0
            ? """
            <label class="bd-file__trigger" for="\(pickerId)"><span id="\(pickerId)-text">\(list.isEmpty ? "Choose a file" : "Add another")\(most > 1 ? " (up to \(remaining) more)" : "")</span>\
            <input class="bd-file__input" type="file" id="\(pickerId)" name="\(name(key, "add").html)"\(flag(remaining > 1, "multiple"))\(allowed.isEmpty ? "" : " accept=\"\(allowed.joined(separator: ",").html)\"")\(aria)\(named) /></label>
            """
            : "<p class=\"bd-field__help\">That's the most files this takes (\(most)).</p>"
        let items = list.enumerated().map { i, f in
            let fileName = f["name"]?.stringValue ?? "file"
            let kb = max(1, Int(((f["size"]?.doubleValue ?? 0) / 1024).rounded()))
            let pending = f["pending"]?.boolValue == true ? " · sends with the form" : ""
            return "<li class=\"bd-file__item\"><span class=\"bd-file__name\">\(fileName.html)</span><span class=\"bd-file__size\">\(kb) KB\(pending)</span><button class=\"bd-file__remove\" type=\"submit\" name=\"_action\" value=\"remove-file:\(key.html):\(i)\" aria-label=\"Remove \(fileName.html)\">✕</button></li>"
        }.joined()
        return """
        <div class="bd-file" role="group" id="\(id)"\(grouped)><input type="hidden" name="\(name(key).html)" value="\(keptJSON.html)" />\
        \(picker)\(list.isEmpty ? "" : "<ul class=\"bd-file__list\">\(items)</ul>")</div>
        """
    }
}

extension Array {
    subscript(safe index: Int) -> Element? { indices.contains(index) ? self[index] : nil }
}
