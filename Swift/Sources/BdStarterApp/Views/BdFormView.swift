import BusinessDashKit
import SwiftUI

/// A minimal schema-driven form renderer.
///
/// This is the one surface a native app genuinely has to reimplement:
/// `<bd-form>` is a DOM web component, so the web starters get conditional
/// blocks, availability pickers and uploads for free while an app does not.
///
/// What's here covers text-ish and choice fields, which is most of a contact
/// form. Extend `field(for:)` as you need — the schema tells you the type.
public struct BdFormView: View {
    let slug: String

    @Environment(BdEnvironment.self) private var bd
    @State private var model: FormViewModel

    public init(slug: String) {
        self.slug = slug
        _model = State(initialValue: FormViewModel(slug: slug))
    }

    public var body: some View {
        LoadableView(state: model.state) { schema in
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
                        Task { await model.submit(schema) }
                    } label: {
                        if model.isSubmitting { ProgressView() } else { Text("Send") }
                    }
                    .disabled(model.isSubmitting || !model.isValid(schema))

                    if let result = model.result {
                        Text(result).font(.footnote).foregroundStyle(.secondary)
                    }
                }
            }
        }
        .task {
            model.bind(bd)
            await model.load()
        }
    }

    /// Field rendering stays in the view: which control a `type` maps to is a
    /// presentation decision, and a view model that returned SwiftUI views
    /// would not be testable without a UI — which is the whole point of having
    /// one.
    @ViewBuilder
    private func field(for field: FormField) -> some View {
        let binding = Binding(
            get: { model.values[field.id] ?? "" },
            set: { model.values[field.id] = $0 }
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
                get: { model.values[field.id] == "true" },
                set: { model.values[field.id] = $0 ? "true" : "false" }
            ))
        default:
            TextField(field.placeholder ?? field.label, text: binding)
        }
    }
}
