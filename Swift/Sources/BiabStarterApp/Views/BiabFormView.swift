import BiabKit
import SwiftUI

/// A minimal schema-driven form renderer.
///
/// This is the one surface a native app genuinely has to reimplement:
/// `<biab-form>` is a DOM web component, so the web starters get conditional
/// blocks, availability pickers and uploads for free while an app does not.
///
/// What's here covers text-ish and choice fields, which is most of a contact
/// form. Extend `field(for:)` as you need — the schema tells you the type.
public struct BiabFormView: View {
    let slug: String

    @Environment(BiabEnvironment.self) private var biab
    @State private var state: LoadState<FormSchema> = .loading
    @State private var values: [String: String] = [:]
    @State private var isSubmitting = false
    @State private var result: String?

    public init(slug: String) {
        self.slug = slug
    }

    public var body: some View {
        LoadableView(state: state) { schema in
            Form {
                if let description = schema.description {
                    Section { Text(description).foregroundStyle(.secondary) }
                }

                Section {
                    ForEach(schema.fields) { field in
                        self.field(for: field)
                    }
                }

                Section {
                    Button {
                        Task { await submit(schema) }
                    } label: {
                        if isSubmitting { ProgressView() } else { Text("Send") }
                    }
                    .disabled(isSubmitting || !isValid(schema))

                    if let result {
                        Text(result).font(.footnote).foregroundStyle(.secondary)
                    }
                }
            }
        }
        .task { await load() }
    }

    @ViewBuilder
    private func field(for field: FormField) -> some View {
        let binding = Binding(
            get: { values[field.id] ?? "" },
            set: { values[field.id] = $0 }
        )

        switch field.type {
        case "select", "radio":
            Picker(field.label, selection: binding) {
                Text("—").tag("")
                ForEach(field.options ?? [], id: \.value) { option in
                    Text(option.label).tag(option.value)
                }
            }
        case "textarea":
            VStack(alignment: .leading) {
                Text(field.label).font(.caption).foregroundStyle(.secondary)
                TextEditor(text: binding).frame(minHeight: 88)
            }
        case "checkbox":
            Toggle(field.label, isOn: Binding(
                get: { values[field.id] == "true" },
                set: { values[field.id] = $0 ? "true" : "false" }
            ))
        default:
            TextField(field.placeholder ?? field.label, text: binding)
        }
    }

    private func isValid(_ schema: FormSchema) -> Bool {
        schema.fields
            .filter(\.isRequired)
            .allSatisfy { !(values[$0.id] ?? "").isEmpty }
    }

    private func load() async {
        guard let client = biab.client else { return }
        state = await LoadState { try await client.forms.schema(slug: slug) }
    }

    private func submit(_ schema: FormSchema) async {
        guard let client = biab.client else { return }
        isSubmitting = true
        defer { isSubmitting = false }

        do {
            let outcome = try await client.forms.submit(
                slug: schema.slug,
                input: FormSubmitInput(data: values)
            )
            result = outcome.succeeded ? "Thanks — we'll be in touch." : (outcome.reason ?? "Could not send.")
            if outcome.succeeded { values = [:] }
        } catch let error as BiabError {
            result = error.errorDescription
        } catch {
            result = error.localizedDescription
        }
    }
}
