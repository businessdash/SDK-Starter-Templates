import BdForms
import Foundation
import Vapor

/// The sample form and quiz bundled with the starter (Resources/Forms), shown
/// before BD is connected. Checked and graded here; nothing is sent.
@MainActor
enum FormSamples {
    private static var cachedForm: BdFormSchema?

    static func form() throws -> BdFormSchema {
        if let cachedForm { return cachedForm }
        let loaded = try JSONDecoder().decode(BdFormSchema.self, from: Data(contentsOf: file("demo-form.json")))
        let schema = BdFormSchema(
            id: loaded.id, slug: FormPage.sampleSlug, title: loaded.title,
            description: "A sample form bundled with the starter, checked here and never sent. Set BD_CONTACT_FORM and your BD keys to show one of your own.",
            fields: loaded.fields, settings: loaded.settings, orgIcon: loaded.orgIcon,
            actions: loaded.actions, businessFunctions: loaded.businessFunctions
        )
        cachedForm = schema
        return schema
    }

    static func file(_ name: String) -> URL {
        URL(fileURLWithPath: DirectoryConfiguration.detect().resourcesDirectory).appendingPathComponent("Forms/\(name)")
    }

    /// The sample's stand-in for BD: everything checks, nothing is sent.
    static let backend: any BdFormsBackend = SampleBackend()

    private struct SampleBackend: BdFormsBackend {
        func schema(form: String) async throws -> BdFormSchema { try await FormSamples.form() }
        func submit(form: String, submission: BdSubmission) async -> BdSubmitResult {
            .success(BdSubmitSuccess(status: 200, submissionId: nil, dryRun: true))
        }
        func upload(form: String, fieldId: String, file: BdPickedFile) async throws -> BdUploadedFile {
            BdUploadedFile(storageId: "demo-\(UUID().uuidString)", url: "", name: file.name, mimeType: file.mimeType, size: file.size)
        }
        func scheduleSlots(form: String, fieldId: String, from: Date, to: Date) async throws -> [String] { [] }
        func paymentIntent(form: String, fieldId: String) async throws -> BdPaymentIntent {
            throw BdFormsError(message: "The sample takes no payments.")
        }
        func collectionOptions(form: String, fieldId: String) async throws -> [BdCollectionOption] { [] }
    }
}
