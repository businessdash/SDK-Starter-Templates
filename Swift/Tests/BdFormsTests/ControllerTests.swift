import Foundation
import SwiftUI
import Testing
@testable import BdForms

/// A backend that records what it was sent and answers from a script.
final class MockBackend: BdFormsBackend, @unchecked Sendable {
    var schemaJSON: BdJSON
    var submitAnswer: (status: Int, body: [String: BdJSON]) = (201, ["submissionId": "sub_1"])
    var submissions: [BdSubmission] = []
    var uploads: [(fieldId: String, name: String)] = []
    var failUploads = false
    let lock = NSLock()

    init(fields: [BdJSON], settings: [String: BdJSON] = [:], extra: [String: BdJSON] = [:]) {
        var o: [String: BdJSON] = [
            "id": "form_1", "slug": "contact", "name": "Contact",
            "fields": .array(fields), "settings": .object(settings), "actions": [],
        ]
        for (k, v) in extra { o[k] = v }
        schemaJSON = .object(o)
    }

    func schema(form: String) async throws -> BdFormSchema {
        try JSONDecoder().decode(BdFormSchema.self, from: JSONEncoder().encode(schemaJSON))
    }

    func submit(form: String, submission: BdSubmission) async -> BdSubmitResult {
        lock.withLock { submissions.append(submission) }
        let (status, body) = submitAnswer
        if (200..<300).contains(status) {
            return .success(.init(status: status, submissionId: body["submissionId"]?.stringValue, dryRun: false, body: body))
        }
        return .failure(BdPackageFormsBackend.failure(status: status, body: body))
    }

    func upload(form: String, fieldId: String, file: BdPickedFile) async throws -> BdUploadedFile {
        if failUploads { throw BdFormsError(status: 500, message: "Upload failed.") }
        lock.withLock { uploads.append((fieldId, file.name)) }
        return BdUploadedFile(storageId: "s/\(file.name)", url: "https://cdn.example.com/\(file.name)", name: file.name, mimeType: file.mimeType, size: file.size)
    }

    func scheduleSlots(form: String, fieldId: String, from: Date, to: Date) async throws -> [String] {
        ["2026-11-24T15:00:00Z", "2026-11-24T16:00:00Z", "2026-11-25T15:00:00Z"]
    }

    func paymentIntent(form: String, fieldId: String) async throws -> BdPaymentIntent {
        try JSONDecoder().decode(BdPaymentIntent.self, from: Data(#"{"mode":"card_on_file","clientSecret":"cs","intentId":"seti_1","publishableKey":"pk","connectedAccountId":"acct"}"#.utf8))
    }

    func collectionOptions(form: String, fieldId: String) async throws -> [BdCollectionOption] {
        try JSONDecoder().decode([BdCollectionOption].self, from: Data(#"[{"value":"r1","label":"Gold","match":{"tier":"premium"}},{"value":"r2","label":"Basic","match":{"tier":"standard"}}]"#.utf8))
    }

    var lastData: [String: BdJSON] { lock.withLock { submissions.last?.data ?? [:] } }
}

@MainActor
func loaded(_ backend: MockBackend) async -> BdFormController {
    let c = BdFormController(form: "contact", backend: backend)
    await c.load()
    return c
}

@Suite("BdFormController")
@MainActor
struct ControllerTests {
    @Test func loadsAndSubmitsWithOutputKeys() async throws {
        let b = MockBackend(fields: [
            ["id": "f1", "type": "text", "label": "Your name", "required": true, "key": "full_name"],
            ["id": "f2", "type": "email", "label": "Email", "required": true],
            ["id": "t", "type": "title", "label": "Hello"],
        ])
        let c = await loaded(b)
        #expect(c.phase == .ready)
        c.setValue("Ada", for: "f1")
        c.setValue("ada@example.com", for: "f2")
        let r = await c.submit()
        #expect(r.isSuccess)
        #expect(c.isSubmitted)
        #expect(b.lastData["full_name"] == "Ada")
        #expect(b.lastData["f2"] == "ada@example.com")
        #expect(b.lastData["t"] == nil)
    }

    @Test func requiredAndFormatErrorsBlockSubmit() async {
        let b = MockBackend(fields: [
            ["id": "name", "type": "text", "label": "Name", "required": true],
            ["id": "email", "type": "email", "label": "Email"],
        ])
        let c = await loaded(b)
        c.setValue("not-an-email", for: "email")
        let r = await c.submit()
        guard case .failure(let f) = r else { Issue.record("expected failure"); return }
        #expect(f.reason == .clientValidationFailed)
        #expect(c.error(for: "name") == "Name is required.")
        #expect(c.error(for: "email") == "Enter a valid email address.")
        #expect(b.submissions.isEmpty)
        #expect(c.errorScrollToken > 0)
    }

    @Test func blurShowsFormatButNotRequiredUntilAttempted() async {
        let b = MockBackend(fields: [
            ["id": "email", "type": "email", "label": "Email", "required": true],
        ])
        let c = await loaded(b)
        c.validate(BdFieldPath("email"))
        #expect(c.error(for: "email") == nil, "an untouched required field stays quiet on blur")
        c.setValue("bad", for: "email")
        c.validate(BdFieldPath("email"))
        #expect(c.error(for: "email") == "Enter a valid email address.")
        c.setValue("good@example.com", for: "email")
        #expect(c.error(for: "email") == nil, "fixing the value clears the error as they type")
    }

    @Test func businessEmailRule() async {
        let b = MockBackend(fields: [
            ["id": "email", "type": "email", "label": "Work email", "emailConfig": ["businessOnly": true]],
        ])
        let c = await loaded(b)
        c.setValue("someone@gmail.com", for: "email")
        c.validate(BdFieldPath("email"))
        #expect(c.error(for: "email") == "Please use your work email address.")
    }

    @Test func steppedFormValidatesEachStepAndFollowsConditions() async {
        let b = MockBackend(fields: [
            ["id": "kind", "type": "radio", "label": "Kind", "required": true, "options": ["Home", "Business"]],
            ["id": "biz", "type": "condition_block", "label": "",
             "conditionRule": ["fieldId": "kind", "operator": "eq", "value": "Business"],
             "children": [["id": "company", "type": "text", "label": "Company", "required": true]]],
            ["id": "notes", "type": "textarea", "label": "Notes"],
        ], settings: ["isConsecutive": true])
        let c = await loaded(b)
        #expect(c.stepCount == 2, "the business page is hidden until chosen")
        #expect(c.next() == false)
        #expect(c.error(for: "kind") == "Kind is required.")
        c.setValue("Business", for: "kind")
        #expect(c.stepCount == 3)
        #expect(c.next())
        #expect(c.currentStep == 1)
        #expect(c.next() == false)
        #expect(c.error(for: "company") == "Company is required.")
        c.back()
        #expect(c.errors.isEmpty)
        c.setValue("Home", for: "kind")
        #expect(c.stepCount == 2)
        let r = await c.submit()
        #expect(r.isSuccess, "a hidden required field doesn't block")
    }

    @Test func repeaterErrorsLandOnTheEntryField() async {
        let b = MockBackend(fields: [
            ["id": "kids", "type": "multi_populator", "label": "Children", "populatorConfig": ["maxInstances": 3],
             "children": [
                ["id": "kname", "type": "text", "label": "Name", "required": true],
                ["id": "kage", "type": "number", "label": "Age", "validation": ["min": 0, "max": 17]],
             ]],
        ])
        let c = await loaded(b)
        let kids = BdFieldPath("kids")
        c.setValue("Sam", at: BdFieldPath("kname", in: kids.entry(0)))
        c.addEntry(to: kids)
        c.setValue(30, at: BdFieldPath("kage", in: kids.entry(1)))
        _ = await c.submit()
        #expect(c.error(for: BdFieldPath("kname", in: kids.entry(1))) == "Name is required.")
        #expect(c.error(for: BdFieldPath("kage", in: kids.entry(1))) == "Enter 17 or less.")
        #expect(c.errors["kids[1].kage"] != nil)
        c.removeEntry(at: 1, from: kids)
        #expect(c.entries(of: kids).count == 1)
        let r = await c.submit()
        #expect(r.isSuccess)
        #expect(b.lastData["kids"] == [["kname": "Sam"]])
    }

    @Test func calculationsRecomputeOnEdit() async {
        let b = MockBackend(fields: [
            ["id": "qty", "type": "number", "label": "Qty"],
            ["id": "price", "type": "currency", "label": "Price"],
            ["id": "total", "type": "calculation", "label": "Total",
             "calculationConfig": ["formula": "q * p", "inputMap": [["variable": "q", "fieldId": "qty"], ["variable": "p", "fieldId": "price"]]]],
        ])
        let c = await loaded(b)
        c.setValue(3, for: "qty")
        c.setValue(2.5, for: "price")
        #expect(c.value("total") == 7.5)
        c.setValue(nil, for: "qty")
        #expect(c.value("total") == .null, "a missing input leaves the result empty")
    }

    @Test func filesUploadOnSubmitAndSwapPlaceholders() async {
        let b = MockBackend(fields: [
            ["id": "docs", "type": "file_upload", "label": "Docs", "fileConfig": ["maxFiles": 2, "allowedTypes": ["application/pdf"]]],
            ["id": "pic", "type": "image_input", "label": "Photo"],
        ])
        let c = await loaded(b)
        let pdf = BdPickedFile(data: Data(repeating: 1, count: 10), name: "a.pdf", mimeType: "application/pdf")
        let png = BdPickedFile(data: Data(repeating: 2, count: 10), name: "b.png", mimeType: "image/png")
        c.addFiles([pdf, png], at: BdFieldPath("docs"))
        #expect(c.value("docs")?.arrayValue?.count == 1, "the png isn't an allowed type")
        #expect(c.error(for: "docs") == "File type not allowed: image/png")
        c.setImage(BdPickedFile(data: Data([0xFF]), name: "me.heic", mimeType: "image/heic"), at: BdFieldPath("pic"))
        #expect(BdFormRules.isPendingUpload(c.value("pic")))
        let r = await c.submit()
        #expect(r.isSuccess)
        #expect(b.uploads.map(\.name).sorted() == ["a.pdf", "me.heic"])
        #expect(b.lastData["docs"]?.arrayValue?.first?["url"] == "https://cdn.example.com/a.pdf")
        #expect(b.lastData["pic"] == "https://cdn.example.com/me.heic")
    }

    @Test func failedUploadKeepsTheFormOpen() async {
        let b = MockBackend(fields: [["id": "docs", "type": "file_upload", "label": "Docs"]])
        b.failUploads = true
        let c = await loaded(b)
        c.addFiles([BdPickedFile(data: Data([1]), name: "x.txt", mimeType: "text/plain")], at: BdFieldPath("docs"))
        let r = await c.submit()
        guard case .failure(let f) = r else { Issue.record("expected failure"); return }
        #expect(f.reason == .networkError)
        #expect(c.error(for: "docs") == "Upload failed.")
        #expect(b.submissions.isEmpty)
        #expect(BdFormRules.isPendingUpload(c.value("docs")?.arrayValue?.first), "the file is still there to retry")
    }

    @Test func serverIssuesMapBackToFields() async {
        let b = MockBackend(fields: [
            ["id": "f1", "type": "text", "label": "Code", "key": "promo"],
        ])
        b.submitAnswer = (422, ["error": "validation_failed", "message": "Bad", "issues": [["id": "promo", "label": "Code", "reason": "regex"]]])
        let c = await loaded(b)
        c.setValue("x", for: "f1")
        let r = await c.submit()
        guard case .failure(let f) = r else { Issue.record("expected failure"); return }
        #expect(f.reason == .validationFailed)
        #expect(c.error(for: "f1") == "Code isn't in the expected format.")
    }

    @Test func statusCodesMapLikeTheJSSDK() {
        func reason(_ status: Int, _ body: [String: BdJSON] = [:]) -> BdSubmitFailure.Reason {
            BdPackageFormsBackend.failure(status: status, body: body).reason
        }
        #expect(reason(401) == .unauthorized)
        #expect(reason(403) == .forbidden)
        #expect(reason(402) == .planRequired)
        #expect(reason(402, ["reason": "payment_required"]) == .paymentRequired)
        #expect(reason(402, ["reason": "service_suspended"]) == .serviceSuspended)
        #expect(reason(429) == .rateLimited)
        #expect(reason(404) == .notFound)
        #expect(reason(400) == .invalidRequest)
        #expect(reason(400, ["error": "validation_failed"]) == .validationFailed)
        #expect(reason(500) == .serverError)
    }

    @Test func collectionMatchConditions() async {
        let b = MockBackend(fields: [
            ["id": "plan", "type": "collection_select", "label": "Plan"],
            ["id": "vip", "type": "condition_block", "label": "",
             "conditionRule": ["fieldId": "plan", "operator": "eq", "value": "premium", "matchField": "tier"],
             "children": [["id": "concierge", "type": "text", "label": "Concierge", "required": true]]],
        ])
        let c = await loaded(b)
        await c.loadCollectionOptions("plan")
        c.setValue("r2", for: "plan")
        #expect(!c.isVisible(c.field("vip")!))
        c.setValue("r1", for: "plan")
        #expect(c.isVisible(c.field("vip")!))
        let r = await c.submit()
        #expect(!r.isSuccess)
        #expect(c.error(for: "concierge") != nil)
    }

    @Test func paymentHandlerStoresTheIntent() async {
        let b = MockBackend(fields: [["id": "card", "type": "credit_card", "label": "Card", "required": true]])
        let c = await loaded(b)
        await c.collectPayment(at: BdFieldPath("card"))
        #expect(c.error(for: "card") == "Card entry isn't set up in this app.")
        c.paymentHandler = { intent, _ in intent.intentId }
        await c.collectPayment(at: BdFieldPath("card"))
        #expect(c.value("card") == "seti_1")
        #expect(c.error(for: "card") == nil)
    }

    @Test func dateRangeOrder() async {
        let b = MockBackend(fields: [["id": "trip", "type": "date_range", "label": "Trip"]])
        let c = await loaded(b)
        c.setValue(["start": "2026-12-10", "end": "2026-12-01"], for: "trip")
        c.validate(BdFieldPath("trip"))
        #expect(c.error(for: "trip") == "The end must come after the start.")
    }

    @Test func customMessages() async {
        let b = MockBackend(fields: [["id": "n", "type": "text", "label": "Nom", "required": true]])
        let c = await loaded(b)
        c.messages = { reason, label, _ in reason == "required" ? "\(label) est obligatoire." : reason }
        _ = await c.submit()
        #expect(c.error(for: "n") == "Nom est obligatoire.")
    }

    @Test func resetRestoresSeedAndDirtyTracks() async {
        let b = MockBackend(fields: [["id": "n", "type": "text", "label": "N", "defaultValue": "hi"]])
        let c = await loaded(b)
        #expect(!c.isDirty)
        c.setValue("changed", for: "n")
        #expect(c.isDirty)
        c.reset()
        #expect(c.value("n") == "hi")
        #expect(!c.isDirty)
    }
}

@Suite("HTML and icons")
struct ConverterTests {
    @Test func readsRichText() {
        let a = BdHTML.attributedString("<p>Hello <strong>bold</strong> &amp; <a href=\"https://x.com\">link</a></p><ul><li>One</li><li>Two</li></ul>")
        let text = String(a.characters)
        #expect(text == "Hello bold & link\n\n• One\n• Two")
        let bold = a.runs.first { String(a[$0.range].characters) == "bold" }
        #expect(bold?.inlinePresentationIntent?.contains(.stronglyEmphasized) == true)
        let link = a.runs.first { String(a[$0.range].characters) == "link" }
        #expect(link?.link == URL(string: "https://x.com"))
    }

    @Test func dropsUnsafeLinks() {
        let a = BdHTML.attributedString("<a href=\"javascript:alert(1)\">x</a>")
        #expect(a.runs.allSatisfy { $0.link == nil })
    }

    @Test func writesRichText() {
        var a = AttributedString("Title\n")
        var bold = AttributedString("bold")
        bold.inlinePresentationIntent = .stronglyEmphasized
        a.append(bold)
        a.append(AttributedString(" <tag>\n•\u{2002}one\n•\u{2002}two\n1.\u{2002}first"))
        let html = BdHTML.html(from: a, isBold: { _ in false }, isItalic: { _ in false })
        #expect(html == "<p>Title</p><p><strong>bold</strong> &lt;tag&gt;</p><ul><li>one</li><li>two</li></ul><ol><li>first</li></ol>")
        #expect(BdHTML.html(from: AttributedString("  \n "), isBold: { _ in false }, isItalic: { _ in false }) == "")
    }

    @Test func parsesLucideSVG() {
        let svg = """
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/><path d="M8 2a1 1 0 01 2 2l-1.5.5z"/><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><polyline points="1 2 3 4 5 6"/></svg>
        """
        let g = BdSVG.glyph(svg)
        let box = g.stroke.boundingRect
        #expect(!g.stroke.isEmpty)
        #expect(g.fill.isEmpty)
        #expect(box.minX >= 0.9 && box.maxX <= 22.1)
        // The arc's radius (1) is too small to span (8,2)→(10,4), so SVG scales
        // it up to √2: a semicircle around (9,3) whose top is at 3 − √2.
        #expect(abs(box.minY - (3 - 2.0.squareRoot())) < 0.02)
        #expect(box.maxY <= 22.1)
    }
}
