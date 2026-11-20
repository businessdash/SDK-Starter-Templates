import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

enum BdFileTypes {
    /// The author's allowed types as system content types, for the pickers.
    static func contentTypes(_ allowed: [String]?) -> [UTType] {
        guard let allowed, !allowed.isEmpty else { return [.item] }
        var out: [UTType] = []
        for raw in BdFormRules.expandAllowedTypes(allowed) {
            let a = raw.lowercased().trimmingCharacters(in: .whitespaces)
            let t: UTType? = switch a {
            case "image/*": .image
            case "video/*": .movie
            case "audio/*": .audio
            case "text/*": .text
            default: a.hasPrefix(".") ? UTType(filenameExtension: String(a.dropFirst())) : UTType(mimeType: a)
            }
            if let t, !out.contains(t) { out.append(t) }
        }
        return out.isEmpty ? [.item] : out
    }

    static func acceptsImages(_ allowed: [String]?) -> Bool {
        guard let allowed, !allowed.isEmpty else { return true }
        return contentTypes(allowed).contains { $0.conforms(to: .image) || UTType.image.conforms(to: $0) }
    }

    static func mimeType(forExtension ext: String) -> String {
        UTType(filenameExtension: ext)?.preferredMIMEType ?? "application/octet-stream"
    }

    static func read(_ url: URL) -> BdPickedFile? {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        guard let data = try? Data(contentsOf: url) else { return nil }
        return BdPickedFile(data: data, name: url.lastPathComponent, mimeType: mimeType(forExtension: url.pathExtension))
    }

    static func load(_ item: PhotosPickerItem, index: Int) async -> BdPickedFile? {
        guard let data = try? await item.loadTransferable(type: Data.self) else { return nil }
        let type = item.supportedContentTypes.first { $0.conforms(to: .image) || $0.conforms(to: .movie) } ?? .jpeg
        let ext = type.preferredFilenameExtension ?? "jpg"
        return BdPickedFile(data: data, name: "Photo \(index + 1).\(ext)", mimeType: type.preferredMIMEType ?? "image/jpeg")
    }
}

/// A thumbnail decoded off the main thread from picked bytes.
struct BdLocalImage: View {
    let file: BdPickedFile
    @State private var image: Image?

    var body: some View {
        Group {
            if let image { image.resizable().scaledToFill() } else { Color.secondary.opacity(0.12) }
        }
        .task(id: file) {
            let data = file.data
            image = await Task.detached(priority: .userInitiated) { () -> Image? in
                #if canImport(UIKit)
                return UIImage(data: data).map { Image(uiImage: $0.preparingThumbnail(of: CGSize(width: 600, height: 600)) ?? $0) }
                #elseif canImport(AppKit)
                return NSImage(data: data).map { Image(nsImage: $0) }
                #else
                return nil
                #endif
            }.value
        }
    }
}

// MARK: - Files

struct BdFileControl: View {
    let ctx: BdFieldContext
    @State private var importing = false
    @State private var photos: [PhotosPickerItem] = []
    @Environment(\.bdFormStrings) private var strings

    var body: some View {
        let cfg = ctx.field.fileConfig
        let files = ctx.value?.arrayValue ?? []
        let maxFiles = max(cfg?.maxFiles ?? 1, 1)
        let remaining = max(maxFiles - files.count, 0)
        BdRows {
            ForEach(Array(files.enumerated()), id: \.offset) { index, file in
                fileRow(file, index: index)
            }
            if remaining > 0 {
                HStack(spacing: 12) {
                    Button { importing = true } label: { Label(strings.chooseFiles, systemImage: "doc.badge.plus") }
                    if BdFileTypes.acceptsImages(cfg?.allowedTypes) {
                        let title = strings.choosePhotos
                        PhotosPicker(selection: $photos, maxSelectionCount: remaining, matching: .images) {
                            Label(title, systemImage: "photo.badge.plus")
                        }
                    }
                }
                .buttonStyle(.borderless)
            }
        }
        .fileImporter(
            isPresented: $importing,
            allowedContentTypes: BdFileTypes.contentTypes(cfg?.allowedTypes),
            allowsMultipleSelection: maxFiles > 1
        ) { result in
            guard case .success(let urls) = result else { return }
            let picked = urls.prefix(remaining).compactMap(BdFileTypes.read)
            ctx.controller.addFiles(Array(picked), at: ctx.path)
        }
        .onChange(of: photos) { _, items in
            guard !items.isEmpty else { return }
            Task {
                var picked: [BdPickedFile] = []
                for (i, item) in items.enumerated() {
                    if let f = await BdFileTypes.load(item, index: files.count + i) { picked.append(f) }
                }
                ctx.controller.addFiles(picked, at: ctx.path)
                photos = []
            }
        }
    }

    private func fileRow(_ file: BdJSON, index: Int) -> some View {
        let pending = BdFormRules.isPendingUpload(file)
        let name = file["name"]?.stringValue ?? "File"
        let size = file["size"]?.doubleValue.map { ByteCountFormatter.string(fromByteCount: Int64($0), countStyle: .file) }
        let local = ctx.controller.pendingFile(file)
        return HStack(spacing: 12) {
            if let local, local.mimeType.hasPrefix("image/") {
                BdLocalImage(file: local).frame(width: 40, height: 40).clipShape(RoundedRectangle(cornerRadius: 6))
            } else {
                Image(systemName: "doc").font(.title3).foregroundStyle(.secondary).frame(width: 40)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(name).lineLimit(1).truncationMode(.middle)
                Text([size, pending ? strings.uploadsOnSubmit : nil].compactMap { $0 }.joined(separator: " · "))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button(role: .destructive) { ctx.controller.removeFile(at: index, from: ctx.path) } label: {
                Image(systemName: "xmark.circle.fill").foregroundStyle(.tertiary)
            }
            .buttonStyle(.borderless)
            .accessibilityLabel("\(strings.removeFile) \(name)")
        }
    }
}

// MARK: - Image

struct BdImageInputControl: View {
    let ctx: BdFieldContext
    enum Source: Hashable { case upload, url }
    @State private var source: Source?
    @State private var item: PhotosPickerItem?
    @Environment(\.bdFormStrings) private var strings
    @Environment(\.bdFormStyle) private var style

    var body: some View {
        let cfg = ctx.field.imageInputConfig
        let sources = cfg?.sources ?? "both"
        let mode: Source = sources == "url" ? .url : sources == "upload" ? .upload : (source ?? .upload)
        let value = ctx.value
        let pending = BdFormRules.isPendingUpload(value) ? ctx.controller.pendingFile(value) : nil
        let url = value?.stringValue.flatMap(BdFormRules.safeHTTPURL)

        BdCard {
            VStack(alignment: .leading, spacing: 12) {
                if sources == "both" {
                    Picker(ctx.field.label, selection: Binding(get: { mode }, set: { source = $0 })) {
                        Text(strings.upload).tag(Source.upload)
                        Text(strings.pasteURL).tag(Source.url)
                    }
                    .pickerStyle(.segmented)
                    .labelsHidden()
                }
                if mode == .upload {
                    let title = strings.choosePhotos
                    PhotosPicker(selection: $item, matching: .images) {
                        Label(title, systemImage: "photo.badge.plus")
                    }
                    .buttonStyle(.bordered)
                } else {
                    TextField(
                        ctx.field.label,
                        text: Binding(
                            get: { pending == nil ? (value?.stringValue ?? "") : "" },
                            set: { ctx.set(.string($0)) }
                        ),
                        prompt: Text(ctx.field.placeholder.flatMap { $0.isEmpty ? nil : $0 } ?? "https://example.com/image.png")
                    )
                    .bdKeyboard(.url)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit(ctx.commit)
                }
                if cfg?.showPreview != false, pending != nil || url != nil {
                    ZStack(alignment: .topTrailing) {
                        Group {
                            if let pending {
                                BdLocalImage(file: pending)
                            } else if let url {
                                AsyncImage(url: url) { $0.resizable().scaledToFill() } placeholder: { ProgressView() }
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 180)
                        .clipShape(RoundedRectangle(cornerRadius: style.cornerRadius))
                        Button { ctx.set(.string("")); item = nil } label: {
                            Image(systemName: "xmark.circle.fill").font(.title2).symbolRenderingMode(.palette)
                                .foregroundStyle(.white, .black.opacity(0.5))
                        }
                        .buttonStyle(.plain)
                        .padding(8)
                        .accessibilityLabel(strings.clear)
                    }
                }
                if let pending {
                    Text("\(pending.name) — \(strings.uploadsOnSubmit.lowercased()).").font(.caption).foregroundStyle(.secondary)
                }
            }
            .padding(.vertical, 4)
        }
        .onChange(of: item) { _, picked in
            guard let picked else { return }
            Task {
                if let file = await BdFileTypes.load(picked, index: 0) { ctx.controller.setImage(file, at: ctx.path) }
            }
        }
    }
}

// MARK: - Card

struct BdCardControl: View {
    let ctx: BdFieldContext
    @State private var busy = false
    @Environment(\.bdFormStrings) private var strings

    var body: some View {
        let pc = ctx.field.paymentConfig
        let deposit = pc?.mode == "deposit"
        let amount = deposit ? pc?.amountCents.map { BdJS.toFixed(Double($0) / 100, 2) + " " + (pc?.currency ?? "usd").uppercased() } : nil
        let saved = !(ctx.value?.stringValue ?? "").isEmpty
        BdCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Image(systemName: "creditcard").foregroundStyle(.tint)
                    Text(deposit ? strings.deposit + (amount.map { " · \($0)" } ?? "") : strings.cardOnFile)
                        .font(.body.weight(.medium))
                    Spacer()
                    if saved {
                        Label(strings.cardSaved, systemImage: "checkmark.seal.fill")
                            .font(.subheadline)
                            .foregroundStyle(.green)
                    }
                }
                if let d = pc?.description, !d.isEmpty {
                    Text(d).font(.subheadline).foregroundStyle(.secondary)
                }
                Button {
                    busy = true
                    Task {
                        await ctx.controller.collectPayment(at: ctx.path)
                        busy = false
                    }
                } label: {
                    HStack {
                        if busy { ProgressView().controlSize(.small) }
                        Text(pc?.buttonLabel.flatMap { $0.isEmpty ? nil : $0 } ?? strings.addCard)
                    }
                }
                .buttonStyle(.bordered)
                .disabled(busy)
            }
            .padding(.vertical, 4)
        }
    }
}

// MARK: - Rich text

/// A native rich text editor that stores the HTML BD keeps.
struct BdRichTextControl: View {
    let ctx: BdFieldContext
    @State private var text = AttributedString()
    @State private var selection = AttributedTextSelection()
    @State private var lastEmitted: String?
    @FocusState private var focused: Bool
    @Environment(\.fontResolutionContext) private var fonts
    @Environment(\.bdFormStyle) private var style

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            toolbar
            TextEditor(text: $text, selection: $selection)
                .focused($focused)
                .frame(minHeight: ctx.field.richTextConfig?.minHeight ?? 140)
                .scrollContentBackground(.hidden)
                .padding(6)
                .background(.fill.quaternary, in: RoundedRectangle(cornerRadius: style.cornerRadius * 0.75))
                .onChange(of: focused) { _, now in if !now { ctx.commit() } }
        }
        .onAppear { adopt(ctx.value?.stringValue ?? "") }
        .onChange(of: text) { _, _ in emit() }
        .onChange(of: ctx.value) { _, new in
            let html = new?.stringValue ?? ""
            if html != lastEmitted { adopt(html) }
        }
    }

    private var toolbar: some View {
        let typing = selection.typingAttributes(in: text)
        let resolved = (typing.font ?? .body).resolve(in: fonts)
        return HStack(spacing: 4) {
            formatButton("bold", active: resolved.isBold) { toggleFont(bold: true) }
            formatButton("italic", active: resolved.isItalic) { toggleFont(bold: false) }
            formatButton("underline", active: typing.underlineStyle != nil) {
                text.transformAttributes(in: &selection) { $0.underlineStyle = $0.underlineStyle == nil ? .single : nil }
            }
            formatButton("strikethrough", active: typing.strikethroughStyle != nil) {
                text.transformAttributes(in: &selection) { $0.strikethroughStyle = $0.strikethroughStyle == nil ? .single : nil }
            }
            Divider().frame(height: 20).padding(.horizontal, 4)
            formatButton("list.bullet", active: false) { toggleList(ordered: false) }
            formatButton("list.number", active: false) { toggleList(ordered: true) }
            Spacer()
        }
    }

    private func formatButton(_ symbol: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .frame(width: 34, height: 30)
                .foregroundStyle(active ? AnyShapeStyle(.white) : AnyShapeStyle(.primary))
                .background(active ? AnyShapeStyle(.tint) : AnyShapeStyle(.fill.tertiary), in: RoundedRectangle(cornerRadius: 6))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(symbol.replacingOccurrences(of: ".", with: " "))
        .accessibilityAddTraits(active ? [.isSelected] : [])
    }

    private func toggleFont(bold: Bool) {
        text.transformAttributes(in: &selection) { c in
            let r = (c.font ?? .body).resolve(in: fonts)
            var isBold = r.isBold, isItalic = r.isItalic
            if bold { isBold.toggle() } else { isItalic.toggle() }
            var f = Font.body
            if isBold { f = f.bold() }
            if isItalic { f = f.italic() }
            c.font = isBold || isItalic ? f : nil
        }
    }

    private func toggleList(ordered: Bool) {
        let chars = text.characters
        let point: AttributedString.Index = switch selection.indices(in: text) {
        case .insertionPoint(let i): i
        case .ranges(let r): r.ranges.first?.lowerBound ?? chars.endIndex
        }
        var start = point
        while start > chars.startIndex {
            let prev = chars.index(before: start)
            if chars[prev] == "\n" { break }
            start = prev
        }
        let line = Substring(String(chars[start...].prefix(while: { $0 != "\n" })))
        let bulletLen = line.hasPrefix(BdHTML.bullet) ? BdHTML.bullet.count : (line.hasPrefix("• ") ? 2 : 0)
        let numberLen = BdHTML.numberedPrefix(line).map { line.distance(from: line.startIndex, to: $0) } ?? 0
        let existing = bulletLen > 0 ? bulletLen : numberLen
        if existing > 0 {
            let end = chars.index(start, offsetBy: existing)
            text.removeSubrange(start..<end)
            let wasOrdered = numberLen > 0
            if wasOrdered == ordered { return }
            // Switch kinds: fall through to insert the other marker.
        }
        var marker = BdHTML.bullet
        if ordered {
            // Continue the numbering of the line above.
            var n = 1
            if start > chars.startIndex {
                let prevEnd = text.characters.index(before: start)
                var prevStart = prevEnd
                while prevStart > text.characters.startIndex, text.characters[text.characters.index(before: prevStart)] != "\n" {
                    prevStart = text.characters.index(before: prevStart)
                }
                let prevLine = String(text.characters[prevStart..<prevEnd])
                if let k = Int(prevLine.prefix(while: \.isASCIIDigit)), BdHTML.numberedPrefix(Substring(prevLine)) != nil { n = k + 1 }
            }
            marker = "\(n).\u{2002}"
        }
        text.insert(AttributedString(marker), at: start)
    }

    private func adopt(_ html: String) {
        lastEmitted = html
        text = BdHTML.editable(html)
    }

    private func emit() {
        let html = BdHTML.html(
            from: text,
            isBold: { ($0.font ?? .body).resolve(in: fonts).isBold },
            isItalic: { ($0.font ?? .body).resolve(in: fonts).isItalic }
        )
        guard html != lastEmitted else { return }
        lastEmitted = html
        ctx.set(.string(html))
    }
}
