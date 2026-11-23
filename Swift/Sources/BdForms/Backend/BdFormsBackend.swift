import Foundation

/// Where a form comes from and where it goes. The default is
/// ``BdPackageFormsBackend`` (BD's Package API with a publishable key), but an
/// app can supply its own (a proxy through its server, a test double, a form
/// bundled offline) without touching the renderer.
public protocol BdFormsBackend: Sendable {
    func schema(form: String) async throws -> BdFormSchema
    func submit(form: String, submission: BdSubmission) async -> BdSubmitResult
    func upload(form: String, fieldId: String, file: BdPickedFile) async throws -> BdUploadedFile
    func scheduleSlots(form: String, fieldId: String, from: Date, to: Date) async throws -> [String]
    func paymentIntent(form: String, fieldId: String) async throws -> BdPaymentIntent
    func collectionOptions(form: String, fieldId: String) async throws -> [BdCollectionOption]
}

/// What goes over the wire on submit.
public struct BdSubmission: Encodable, Sendable {
    public var data: [String: BdJSON]
    public var submitterEmail: String?
    public var submitterName: String?
    /// Validate server-side without saving, notifying, or running actions.
    public var dryRun: Bool?
    public var source: String?
    public var referrer: String?
    public var metadata: [String: BdJSON]?

    public init(
        data: [String: BdJSON],
        submitterEmail: String? = nil,
        submitterName: String? = nil,
        dryRun: Bool? = nil,
        source: String? = nil,
        referrer: String? = nil,
        metadata: [String: BdJSON]? = nil
    ) {
        self.data = data
        self.submitterEmail = submitterEmail
        self.submitterName = submitterName
        self.dryRun = dryRun
        self.source = source
        self.referrer = referrer
        self.metadata = metadata
    }
}

/// A file the visitor picked, held in memory until submit uploads it.
public struct BdPickedFile: Sendable, Hashable {
    public let data: Data
    public let name: String
    public let mimeType: String

    public init(data: Data, name: String, mimeType: String) {
        self.data = data
        self.name = name
        self.mimeType = mimeType
    }

    public var size: Int { data.count }
}

/// A file stored by BD: the value a `file_upload` field submits.
public struct BdUploadedFile: Codable, Sendable, Hashable {
    public let storageId: String
    public let url: String
    public let name: String
    public let mimeType: String
    public let size: Int

    public init(storageId: String, url: String, name: String, mimeType: String, size: Int) {
        self.storageId = storageId
        self.url = url
        self.name = name
        self.mimeType = mimeType
        self.size = size
    }

    var json: BdJSON {
        ["storageId": .string(storageId), "url": .string(url), "name": .string(name),
         "mimeType": .string(mimeType), "size": .number(Double(size))]
    }
}

public struct BdPaymentIntent: Decodable, Sendable, Hashable {
    /// `card_on_file` (SetupIntent) or `deposit` (PaymentIntent).
    public let mode: String
    public let clientSecret: String
    public let intentId: String
    /// The platform's Stripe publishable key.
    public let publishableKey: String
    /// The org's connected account: initialize Stripe with it.
    public let connectedAccountId: String

    public init(mode: String, clientSecret: String, intentId: String, publishableKey: String, connectedAccountId: String) {
        self.mode = mode
        self.clientSecret = clientSecret
        self.intentId = intentId
        self.publishableKey = publishableKey
        self.connectedAccountId = connectedAccountId
    }
}

/// One live option of a `collection_select`: a record from the org's
/// collection, with the columns its conditions compare.
public struct BdCollectionOption: Decodable, Sendable, Hashable, Identifiable {
    public let value: String
    public let label: String
    public let image: String?
    public let match: [String: String]?
    public var id: String { value }

    public init(value: String, label: String, image: String? = nil, match: [String: String]? = nil) {
        self.value = value
        self.label = label
        self.image = image
        self.match = match
    }
}

public struct BdFormIssue: Sendable, Hashable {
    public init(fieldId: String, label: String, reason: String, message: String) {
        self.fieldId = fieldId
        self.label = label
        self.reason = reason
        self.message = message
    }

    public let fieldId: String
    public let label: String
    /// `required | type | format | min | max | options | regex |
    /// business_email | unknown_field | …`
    public let reason: String
    public let message: String
}

extension BdFormIssue {
    public init(fieldId: String, label: String, reason: String) {
        self.init(fieldId: fieldId, label: label, reason: reason, message: BdFormMessages.message(reason: reason, label: label, field: nil))
    }
}

public enum BdSubmitResult: Sendable {
    case success(BdSubmitSuccess)
    case failure(BdSubmitFailure)

    public var isSuccess: Bool { if case .success = self { return true } else { return false } }
}

public struct BdSubmitSuccess: Sendable {
    public let status: Int
    public let submissionId: String?
    public let dryRun: Bool
    /// The whole response body, for anything the server adds.
    public let body: [String: BdJSON]

    public init(status: Int = 201, submissionId: String?, dryRun: Bool = false, body: [String: BdJSON] = [:]) {
        self.status = status
        self.submissionId = submissionId
        self.dryRun = dryRun
        self.body = body
    }
}

public struct BdSubmitFailure: Error, Sendable {
    public enum Reason: String, Sendable {
        case clientValidationFailed = "client_validation_failed"
        case validationFailed = "validation_failed"
        case unauthorized, forbidden
        case planRequired = "plan_required"
        case paymentRequired = "payment_required"
        case serviceSuspended = "service_suspended"
        case rateLimited = "rate_limited"
        case notFound = "not_found"
        case invalidRequest = "invalid_request"
        case serverError = "server_error"
        case networkError = "network_error"
    }

    public let status: Int
    public let reason: Reason
    public let message: String
    public let issues: [BdFormIssue]

    public init(status: Int, reason: Reason, message: String, issues: [BdFormIssue] = []) {
        self.status = status
        self.reason = reason
        self.message = message
        self.issues = issues
    }
}

public struct BdFormsError: Error, LocalizedError, Sendable {
    public let status: Int
    public let message: String

    public init(status: Int = 0, message: String) {
        self.status = status
        self.message = message
    }

    public var errorDescription: String? { message }
}

// MARK: - Package API

/// BD's Package API, authenticated with a publishable (`pk_…`) key.
///
/// A publishable key is meant to ship inside an app. A secret key is not,
/// and passing one traps in debug builds rather than letting it ride along.
public struct BdPackageFormsBackend: BdFormsBackend {
    public let baseURL: URL
    let publishableKey: String
    let session: URLSession

    /// - Parameters:
    ///   - host: e.g. `https://businessdash.us` (not www: it redirects to the
    ///     apex, and a redirect to another host drops the key). `/api/package/v1` is appended.
    public init(host: URL, publishableKey: String, session: URLSession = .shared) {
        // A precondition, not an assert: release builds are the ones that
        // ship the key inside the binary, so they're the ones that must stop.
        precondition(!publishableKey.hasPrefix("sk_"), "BdForms: never ship a secret key in an app; use a pk_ key.")
        self.baseURL = host.appendingPathComponent("api/package/v1")
        self.publishableKey = publishableKey
        self.session = session
    }

    func url(_ form: String, _ suffix: String = "", query: [URLQueryItem] = []) -> URL {
        var url = baseURL.appendingPathComponent("forms").appendingPathComponent(form)
        if !suffix.isEmpty { url.appendPathComponent(suffix) }
        guard !query.isEmpty, var comps = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return url }
        comps.queryItems = query
        return comps.url ?? url
    }

    func request(_ url: URL, method: String = "GET", json: Data? = nil) -> URLRequest {
        var r = URLRequest(url: url)
        r.httpMethod = method
        r.setValue("Bearer \(publishableKey)", forHTTPHeaderField: "Authorization")
        r.setValue("application/json", forHTTPHeaderField: "Accept")
        r.setValue("swift-forms/1", forHTTPHeaderField: "X-BD-Client")
        if let json {
            r.httpBody = json
            r.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        return r
    }

    func send<T: Decodable>(_ req: URLRequest, as: T.Type) async throws -> T {
        let (data, response) = try await session.data(for: req)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let body = try? JSONDecoder().decode(BdJSON.self, from: data)
            throw BdFormsError(status: status, message: body?["message"]?.stringValue ?? "BD returned \(status).")
        }
        return try JSONDecoder().decode(T.self, from: data)
    }

    public func schema(form: String) async throws -> BdFormSchema {
        try await send(request(url(form)), as: BdFormSchema.self)
    }

    public func submit(form: String, submission: BdSubmission) async -> BdSubmitResult {
        let body: Data
        do {
            body = try JSONEncoder().encode(submission)
        } catch {
            return .failure(.init(status: 0, reason: .invalidRequest, message: "Couldn't encode the submission.", issues: []))
        }
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request(url(form), method: "POST", json: body))
        } catch {
            return .failure(.init(status: 0, reason: .networkError, message: "Could not reach BD: \(error.localizedDescription)", issues: []))
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        let json = (try? JSONDecoder().decode(BdJSON.self, from: data))?.objectValue ?? [:]
        if (200..<300).contains(status) {
            return .success(.init(
                status: status,
                submissionId: json["submissionId"]?.stringValue,
                dryRun: json["dryRun"]?.boolValue ?? false,
                body: json
            ))
        }
        return .failure(Self.failure(status: status, body: json))
    }

    /// Map a non-2xx response the way the JS SDK does, so the same server
    /// answer becomes the same reason in every language.
    static func failure(status: Int, body: [String: BdJSON]) -> BdSubmitFailure {
        let message = body["message"]?.stringValue.flatMap { $0.isEmpty ? nil : $0 } ?? "Submission failed (\(status))."
        let code = body["error"]?.stringValue
        let gate = body["reason"]?.stringValue
        let issues: [BdFormIssue] = (body["issues"]?.arrayValue ?? []).map { raw in
            let id = raw["id"]?.stringValue ?? raw["fieldId"]?.stringValue ?? ""
            let label = raw["label"]?.stringValue ?? (id.isEmpty ? "field" : id)
            let reason = raw["reason"]?.stringValue ?? "type"
            return BdFormIssue(
                fieldId: id, label: label, reason: reason,
                message: raw["message"]?.stringValue ?? BdFormMessages.message(reason: reason, label: label, field: nil)
            )
        }
        let reason: BdSubmitFailure.Reason
        switch status {
        case 401: reason = .unauthorized
        case 403: reason = .forbidden
        case 402: reason = gate == "payment_required" ? .paymentRequired : gate == "service_suspended" ? .serviceSuspended : .planRequired
        case 429: reason = .rateLimited
        case 404: reason = .notFound
        case 400, 422: reason = code == "validation_failed" || !issues.isEmpty ? .validationFailed : .invalidRequest
        default: reason = .serverError
        }
        return BdSubmitFailure(status: status, reason: reason, message: message, issues: issues)
    }

    struct Presign: Decodable { let uploadUrl: String; let storageId: String; let publicUrl: String }

    public func upload(form: String, fieldId: String, file: BdPickedFile) async throws -> BdUploadedFile {
        let body: BdJSON = [
            "fieldId": .string(fieldId), "filename": .string(file.name),
            "contentType": .string(file.mimeType), "sizeBytes": .number(Double(file.size)),
        ]
        let presign = try await send(
            request(url(form, "upload-url"), method: "POST", json: try JSONEncoder().encode(body)),
            as: Presign.self
        )
        guard let target = URL(string: presign.uploadUrl) else {
            throw BdFormsError(status: 0, message: "BD returned an invalid upload URL.")
        }
        var put = URLRequest(url: target)
        put.httpMethod = "PUT"
        put.setValue(file.mimeType, forHTTPHeaderField: "Content-Type")
        let (_, response) = try await session.upload(for: put, from: file.data)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            throw BdFormsError(status: status, message: "Uploading \(file.name) failed (\(status)).")
        }
        return BdUploadedFile(storageId: presign.storageId, url: presign.publicUrl, name: file.name, mimeType: file.mimeType, size: file.size)
    }

    struct Slots: Decodable { struct Slot: Decodable { let startAt: String }; let slots: [Slot] }

    public func scheduleSlots(form: String, fieldId: String, from: Date, to: Date) async throws -> [String] {
        let u = url(form, "schedule-slots", query: [
            .init(name: "fieldId", value: fieldId),
            .init(name: "from", value: BdDates.isoString(from)),
            .init(name: "to", value: BdDates.isoString(to)),
        ])
        return try await send(request(u), as: Slots.self).slots.map(\.startAt)
    }

    public func paymentIntent(form: String, fieldId: String) async throws -> BdPaymentIntent {
        let body = try JSONEncoder().encode(BdJSON.object(["fieldId": .string(fieldId)]))
        return try await send(request(url(form, "payment-intent"), method: "POST", json: body), as: BdPaymentIntent.self)
    }

    struct Options: Decodable { let options: [BdCollectionOption] }

    public func collectionOptions(form: String, fieldId: String) async throws -> [BdCollectionOption] {
        let u = url(form, "collection-options", query: [.init(name: "fieldId", value: fieldId)])
        return try await send(request(u), as: Options.self).options
    }
}

// MARK: - Messages

/// What a visitor reads under a field. One function so every element says
/// the same thing for the same problem, and an app can localize it by
/// supplying its own ``BdFormStrings``.
public enum BdFormMessages {
    public static func message(reason: String, label: String, field: BdFormField?) -> String {
        let name = label.isEmpty ? "This field" : label
        switch reason {
        case "required":
            if field?.type == "boolean", field?.mustBeTrue == true { return "Please confirm to continue." }
            if field?.type == "or_condition" { return "Fill in at least one side to continue." }
            if field?.type == "multi_populator" { return "Add at least one entry." }
            return "\(name) is required."
        case "business_email": return "Please use your work email address."
        case "regex": return "\(name) isn't in the expected format."
        case "options": return "Choose one of the listed options."
        case "unknown_field": return "\(name) isn't part of this form."
        case "range_order": return "The end must come after the start."
        case "range_same_day": return "Choose an end date after the start date."
        case "format":
            switch field?.type {
            case "email": return "Enter a valid email address."
            case "phone": return "Enter a valid phone number."
            case "url", "image_input": return "Enter a valid web address, like example.com."
            case "address": return "Enter a 5-digit ZIP code."
            case "month_year": return "Choose a month and a year."
            case "color_picker": return "Enter a hex color, like #3366FF."
            case "schedule": return "Choose a valid time."
            case "number", "measurement": return "Enter a whole number."
            case "currency":
                return field?.currencyConfig?.allowDecimal == false ? "Enter a whole amount." : "Enter an amount of 0 or more."
            default: return "\(name) isn't valid."
            }
        case "min":
            if let min = field?.validation?.min ?? field?.sliderConfig?.min {
                return "Enter \(BdJS.string(min)) or more."
            }
            return "Enter 0 or more."
        case "max":
            if let max = field?.validation?.max ?? field?.sliderConfig?.max {
                return "Enter \(BdJS.string(max)) or less."
            }
            if field?.type == "file_upload" {
                let n = field?.fileConfig?.maxFiles ?? 1
                return "Attach at most \(n) file\(n == 1 ? "" : "s")."
            }
            if field?.type == "star_rating" { return "Choose up to \(field?.starRatingConfig?.maxStars ?? 5) stars." }
            return "\(name) is too long."
        case "type": return "\(name) has an invalid value."
        default:
            // A repeater reports its child: "Age: max".
            if let colon = reason.firstIndex(of: ":") {
                return "\(reason[..<colon]): \(message(reason: reason[reason.index(after: colon)...].trimmingCharacters(in: .whitespaces), label: "", field: nil).lowercased())"
            }
            return "\(name) isn't valid."
        }
    }
}
