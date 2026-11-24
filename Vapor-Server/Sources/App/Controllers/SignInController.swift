import Foundation
import Vapor

/// The business's sign-in screen on `/my-account`, rendered on this server.
///
/// The same screen every BD starter shows (`<BdSignIn>`, the Swift app's
/// `BdSignInView`, Kotlin's `:bd-sign-in`): the business's logo, name and
/// brand colours, email and password, a new account confirmed by a 6-digit
/// emailed code, a forgotten password reset by code, and "Continue with
/// Google / Apple / GitHub / Discord". Words, checks and colours are
/// `SignInCore.swift` (a port of `@businessdash/sdk/sign-in-core`); the markup
/// and `Public/bd-sign-in.css` are the SDK screen's.
///
/// Nothing here signs anyone in by itself: every step is
/// `AccountController.forward` — BD's `auth/customer/*`, which runs it
/// through WorkOS — and a sign-in sets the httpOnly `bd_session` cookie.
/// "Continue with …" is a plain link to `/api/bd-auth/customer/oauth/{provider}`.
///
/// In the browser (htmx, loaded by `base.leaf`):
///   • leaving a box you typed in checks it (`POST /my-account/sign-in/check`),
///     and a box marked wrong is re-checked as you type until it's right;
///   • the button checks every box here first and sends nothing until they're
///     right; BD's answers about a box (a weak password, a wrong code) land
///     under it, the rest above the button — without clearing what was typed;
///   • it all works without JavaScript too, as a plain form post.
///
/// The code step's details (BD's pending id, and what it takes to send a new
/// code) travel in one hidden field, sealed with AES-GCM under a key derived
/// from this server's BD key — the browser can't read or change them.
enum SignInController {
    static let path = "/my-account"
    private static let postPath = "/my-account/sign-in"
    private static let checkPath = "/my-account/sign-in/check"
    private static let id = "bd-sign-in"

    // MARK: - State

    /// The code step's details, sealed into the form between requests.
    struct Pending: Codable, Sendable {
        let pendingId: String
        let purpose: SignInPurpose
        let email: String
        /// To send a new code: sign-up and "confirm your email" re-send with it.
        let password: String?
        let firstName: String?
        let lastName: String?
        /// Seconds since 1970 after which the sealed details are refused.
        let expires: Double
    }

    /// What BD says the business offers on its sign-in screen.
    struct Options: Sendable {
        var name: String?
        var password = true
        var oauth: [SignInProvider] = []
        var primaryColor: String?
        var secondaryColor: String?
        var logoURL: String?
    }

    struct Screen: Sendable {
        var step: SignInStep
        var pending: Pending?
        var sealed: String?
        var values: [SignInField: String] = [:]
        var errors: [SignInField: String] = [:]
        var problem: String?
        var notice: String?
        var focus: SignInField?
        var options: Options
        /// Where a finished sign-in goes instead of the account page (`?next=`, e.g. a quiz invitation).
        var next: String?
    }

    /// `next` when it's a path on this site, else nil — never another site.
    static func safeNext(_ value: String?) -> String? {
        guard let value, value.count <= 512, value.hasPrefix("/"), !value.hasPrefix("//"), !value.hasPrefix("/\\") else { return nil }
        return value
    }

    /// Back here with `next` kept, so a provider's refusal still shows this screen.
    private static func accountPath(_ next: String?) -> String {
        guard let next else { return path }
        return "\(path)?next=\(next.uriComponent)"
    }

    // MARK: - The page

    /// For `/my-account` when nobody's signed in.
    static func section(req: Request) async -> String {
        let failed = req.query[String.self, at: "bd_oauth_error"]
        let screen = Screen(
            step: req.query[String.self, at: "start"] == "create" ? .createAccount : .signIn,
            // Back from a provider that didn't finish.
            problem: failed == nil ? nil : (req.query[String.self, at: "bd_oauth_message"]?.nilIfEmpty ?? "Sign-in didn't finish. Try again."),
            options: await options(req),
            next: safeNext(req.query[String.self, at: "next"])
        )
        return section(screen)
    }

    private static func section(_ screen: Screen) -> String {
        """
        <link rel="stylesheet" href="/bd-sign-in.css">
        <div class="signin-card">\(render(screen))</div>
        <script>document.body.addEventListener("bd-sign-in-focus",function(e){var el=document.getElementById("\(id)-"+e.detail.value);if(el)el.focus();});</script>
        """
    }

    // MARK: - Requests

    /// `POST /my-account/sign-in/check` — one box, as the person leaves it.
    static func check(req: Request) async throws -> Response {
        let form = (try? req.content.decode([String: String].self)) ?? [:]
        guard let name = req.headers.first(name: "HX-Trigger-Name"), let field = SignInField(rawValue: name) else {
            return Response(status: .badRequest)
        }
        let step = form["step"].flatMap(SignInStep.init(rawValue:)) ?? .signIn
        let message = SignInChecks.problem(field, values(form)[field] ?? "", step: step)
        return html(errorSlot(field, message))
    }

    /// `POST /my-account/sign-in` — the button, a link ("Forgot password?",
    /// "Send a new code", …) or six digits in the code box. Renders the next
    /// step, signs in (cookie + redirect), or says what's wrong.
    static func submit(req: Request) async throws -> Response {
        let htmx = req.headers.first(name: "HX-Request") == "true"
        let form = (try? req.content.decode([String: String].self)) ?? [:]
        let go = form["go"]
        let postedStep = form["step"].flatMap(SignInStep.init(rawValue:)) ?? .signIn
        let typed = values(form)
        let pending = postedStep == .code ? unseal(form["state"], req) : nil
        var screen = Screen(
            step: postedStep,
            pending: pending,
            sealed: pending == nil ? nil : form["state"],
            values: typed,
            options: await options(req),
            next: safeNext(form["next"])
        )

        /// A new step (or the same one, fresh): the whole screen.
        func show(_ next: Screen) async throws -> Response {
            guard htmx else { return try await fullPage(req, section(next)) }
            let response = html(render(next))
            // `autofocus` alone isn't honoured in swapped content.
            if let focus = next.focus {
                response.headers.replaceOrAdd(name: "HX-Trigger-After-Settle", value: #"{"bd-sign-in-focus":"\#(focus.rawValue)"}"#)
            }
            return response
        }

        /// What's wrong, under the boxes — htmx leaves the typed values where they are.
        func refuse() async throws -> Response {
            guard htmx else { return try await show(screen) }
            let shown = fields(screen)
            var parts = shown.map { errorSlot($0, screen.errors[$0], oob: true) }
            parts.append(problemSlot(screen.problem, oob: true))
            parts.append(noticeSlot(nil, oob: true))
            let response = html(parts.joined())
            response.headers.replaceOrAdd(name: "HX-Reswap", value: "none")
            if let first = shown.first(where: { screen.errors[$0] != nil }) {
                response.headers.replaceOrAdd(name: "HX-Trigger", value: #"{"bd-sign-in-focus":"\#(first.rawValue)"}"#)
            }
            return response
        }

        func signedIn(_ token: String, _ expires: Date) -> Response {
            let response: Response
            if htmx {
                response = Response(status: .ok)
                response.headers.replaceOrAdd(name: "HX-Redirect", value: screen.next ?? path)
            } else {
                response = Response(status: .seeOther)
                response.headers.replaceOrAdd(name: .location, value: screen.next ?? path)
            }
            response.headers.replaceOrAdd(name: .cacheControl, value: "no-store")
            response.cookies[AccountController.sessionCookie] = AccountController.session(req, token, expires)
            return response
        }

        func toCode(_ sent: JSONValue, _ purpose: SignInPurpose, email: String, password: String?, firstName: String?, lastName: String?, notice: String? = nil) async throws -> Response {
            guard let pendingId = sent.string("pendingId") else {
                screen.problem = AccountController.unavailable
                return try await refuse()
            }
            let expires = sent.string("expiresAt").flatMap(instant)?.timeIntervalSince1970 ?? Date().addingTimeInterval(15 * 60).timeIntervalSince1970
            let next = Pending(pendingId: pendingId, purpose: purpose, email: email, password: password, firstName: firstName, lastName: lastName, expires: expires)
            var shown = screen
            shown.step = .code
            shown.pending = next
            shown.sealed = seal(next, req)
            shown.errors = [:]
            shown.problem = nil
            shown.notice = notice
            shown.focus = .code
            shown.values[.code] = nil
            shown.values[.newPassword] = nil
            return try await show(shown)
        }

        func failed(_ code: String, _ message: String) async throws -> Response {
            if let field = SignInChecks.field(forCode: code, among: fields(screen)) {
                screen.errors[field] = message
            } else {
                screen.problem = message
            }
            return try await refuse()
        }

        guard let bd = req.bd else {
            screen.problem = "Sign-in isn't set up yet."
            return try await refuse()
        }

        // The code step's details didn't survive (expired, or from another server).
        if postedStep == .code, pending == nil {
            return try await show(Screen(step: .signIn, problem: "That code has expired. Start again.", focus: .email, options: screen.options, next: screen.next))
        }

        // A link: another step, or a new code.
        if let go, let next = SignInStep(rawValue: go), next != .code {
            var carried: [SignInField: String] = [:]
            carried[.email] = typed[.email] ?? pending?.email ?? ""
            carried[.firstName] = typed[.firstName] ?? ""
            carried[.lastName] = typed[.lastName] ?? ""
            return try await show(Screen(step: next, values: carried, focus: next == .createAccount ? .firstName : .email, options: screen.options, next: screen.next))
        }
        if go == "resend", let pending {
            let answer: AccountController.CustomerAnswer
            switch pending.purpose {
            case .signUp:
                answer = await AccountController.forward(bd, "sign-up", body: .object([
                    "email": .string(pending.email),
                    "password": .string(pending.password ?? ""),
                    "firstName": pending.firstName.map(JSONValue.string) ?? .null,
                    "lastName": pending.lastName.map(JSONValue.string) ?? .null,
                ]))
            case .verify:
                answer = await AccountController.forward(bd, "sign-in", body: .object([
                    "email": .string(pending.email),
                    "password": .string(pending.password ?? ""),
                ]))
            case .reset:
                answer = await AccountController.forward(bd, "forgot-password", body: .object(["email": .string(pending.email)]))
            }
            switch answer {
            case .signedIn(let token, let expires, _):
                return signedIn(token, expires)
            case .refused(_, _, let message):
                screen.problem = message
                return try await refuse()
            case .answered(let sent):
                return try await toCode(sent, pending.purpose, email: pending.email, password: pending.password, firstName: pending.firstName, lastName: pending.lastName, notice: SignInWords.codeResent)
            }
        }

        // The button: every box first, then BD.
        for field in fields(screen) {
            if let message = SignInChecks.problem(field, typed[field] ?? "", step: screen.step) {
                screen.errors[field] = message
            }
        }
        if !screen.errors.isEmpty { return try await refuse() }

        let email = (typed[.email] ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let password = typed[.password] ?? ""
        switch screen.step {
        case .signIn:
            switch await AccountController.forward(bd, "sign-in", body: .object(["email": .string(email), "password": .string(password)])) {
            case .signedIn(let token, let expires, _): return signedIn(token, expires)
            case .refused(_, let code, let message): return try await failed(code, message)
            // WorkOS wants the email confirmed first; it has sent a code.
            case .answered(let sent): return try await toCode(sent, .verify, email: email, password: password, firstName: nil, lastName: nil)
            }
        case .createAccount:
            let first = clean(typed[.firstName]), last = clean(typed[.lastName])
            switch await AccountController.forward(bd, "sign-up", body: .object([
                "email": .string(email),
                "password": .string(password),
                "firstName": first.map(JSONValue.string) ?? .null,
                "lastName": last.map(JSONValue.string) ?? .null,
            ])) {
            case .answered(let sent): return try await toCode(sent, .signUp, email: email, password: password, firstName: first, lastName: last)
            case .refused(_, let code, let message): return try await failed(code, message)
            case .signedIn(let token, let expires, _): return signedIn(token, expires)
            }
        case .forgot:
            switch await AccountController.forward(bd, "forgot-password", body: .object(["email": .string(email)])) {
            case .answered(let sent): return try await toCode(sent, .reset, email: email, password: nil, firstName: nil, lastName: nil)
            case .refused(_, let code, let message): return try await failed(code, message)
            case .signedIn(let token, let expires, _): return signedIn(token, expires)
            }
        case .code:
            guard let pending else { return try await refuse() }
            switch await AccountController.forward(bd, "verify", body: .object([
                "pendingId": .string(pending.pendingId),
                "code": .string(typed[.code] ?? ""),
                "newPassword": pending.purpose == .reset ? .string(typed[.newPassword] ?? "") : .null,
            ])) {
            case .signedIn(let token, let expires, _): return signedIn(token, expires)
            case .refused(_, let code, let message): return try await failed(code, message)
            case .answered: return try await failed("unavailable", AccountController.unavailable)
            }
        }
    }

    /// `/my-account` with the screen in it — a no-script form post's answer.
    private static func fullPage(_ req: Request, _ section: String) async throws -> Response {
        let view = try await req.view.render("account", AccountContext(
            configured: req.application.bdConfigured, signedIn: false, signIn: section, email: "", jobs: []
        ))
        let response = try await view.encodeResponse(for: req)
        response.headers.replaceOrAdd(name: .cacheControl, value: "no-store")
        return response
    }

    // MARK: - BD's options

    private actor OptionsCache {
        var value: (at: Date, options: Options)?
        func get() -> Options? {
            guard let value, Date().timeIntervalSince(value.at) < 60 else { return nil }
            return value.options
        }
        func set(_ options: Options) { value = (Date(), options) }
        func last() -> Options? { value?.options }
    }

    private static let cache = OptionsCache()

    /// The business's name, logo, colours and providers — asked once a minute.
    private static func options(_ req: Request) async -> Options {
        if let cached = await cache.get() { return cached }
        guard let bd = req.bd, case .answered(let body) = await AccountController.forward(bd, "options") else {
            return await cache.last() ?? Options()
        }
        var options = Options()
        options.name = body.string("name")
        options.password = body["password"]?.boolValue ?? true
        options.oauth = (body["oauth"]?.arrayValue ?? []).compactMap { $0.stringValue.flatMap(SignInProvider.init(rawValue:)) }
        options.primaryColor = body.string("primaryColor")
        options.secondaryColor = body.string("secondaryColor")
        options.logoURL = body.string("logoUrl").flatMap { $0.hasPrefix("https://") ? $0 : nil }
        await cache.set(options)
        return options
    }

    // MARK: - Sealed code-step details

    private static func key(_ req: Request) -> SymmetricKey {
        SymmetricKey(data: SHA256.hash(data: Data("bd-sign-in-state:\(req.bd?.apiKey ?? "")".utf8)))
    }

    private static func seal(_ pending: Pending, _ req: Request) -> String? {
        guard
            let data = try? JSONEncoder().encode(pending),
            let combined = try? AES.GCM.seal(data, using: key(req)).combined
        else { return nil }
        return base64URL(combined)
    }

    private static func unseal(_ value: String?, _ req: Request) -> Pending? {
        guard
            let value, let data = fromBase64URL(value),
            let box = try? AES.GCM.SealedBox(combined: data),
            let opened = try? AES.GCM.open(box, using: key(req)),
            let pending = try? JSONDecoder().decode(Pending.self, from: opened),
            pending.expires > Date().timeIntervalSince1970
        else { return nil }
        return pending
    }

    private static func base64URL(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private static func fromBase64URL(_ text: String) -> Data? {
        var base64 = text.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while base64.count % 4 != 0 { base64 += "=" }
        return Data(base64Encoded: base64)
    }

    // MARK: - Rendering

    private static func fields(_ screen: Screen) -> [SignInField] {
        switch screen.step {
        case .signIn: [.email, .password]
        case .createAccount: [.firstName, .lastName, .email, .password]
        case .forgot: [.email]
        case .code: screen.pending?.purpose == .reset ? [.code, .newPassword] : [.code]
        }
    }

    private static func values(_ form: [String: String]) -> [SignInField: String] {
        var out: [SignInField: String] = [:]
        for field in SignInField.allCases {
            guard let value = form[field.rawValue] else { continue }
            out[field] = field == .code ? String(value.filter { $0.isASCII && $0.isNumber }.prefix(6)) : value
        }
        return out
    }

    private static func clean(_ text: String?) -> String? {
        (text ?? "").trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
    }

    private static func esc(_ text: String) -> String {
        text.replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
            .replacingOccurrences(of: "'", with: "&#39;")
    }

    private static func html(_ body: String) -> Response {
        let response = Response(status: .ok, body: .init(string: body))
        response.headers.replaceOrAdd(name: .contentType, value: "text/html; charset=utf-8")
        response.headers.replaceOrAdd(name: .cacheControl, value: "no-store")
        return response
    }

    private static func errorID(_ field: SignInField) -> String { "\(id)-\(field.rawValue)-error" }

    private static func errorSlot(_ field: SignInField, _ message: String?, oob: Bool = false) -> String {
        "<p class=\"bd-sign-in__error\" id=\"\(errorID(field))\" aria-live=\"polite\"\(oob ? " hx-swap-oob=\"true\"" : "")\(message == nil ? " hidden" : "")>\(esc(message ?? ""))</p>"
    }

    private static func problemSlot(_ text: String?, oob: Bool = false) -> String {
        "<p class=\"bd-sign-in__problem\" id=\"\(id)-problem\" role=\"alert\"\(oob ? " hx-swap-oob=\"true\"" : "")\(text == nil ? " hidden" : "")>\(esc(text ?? ""))</p>"
    }

    private static func noticeSlot(_ text: String?, oob: Bool = false) -> String {
        "<p class=\"bd-sign-in__notice\" id=\"\(id)-notice\" role=\"status\"\(oob ? " hx-swap-oob=\"true\"" : "")\(text == nil ? " hidden" : "")>\(esc(text ?? ""))</p>"
    }

    private static func input(_ field: SignInField, _ screen: Screen) -> String {
        let error = screen.errors[field]
        let label = SignInWords.label(field)
        let type = switch field {
        case .email: "email"
        case .password, .newPassword: "password"
        default: "text"
        }
        let autocomplete = switch field {
        case .firstName: "given-name"
        case .lastName: "family-name"
        case .email: "email"
        case .password: screen.step == .createAccount ? "new-password" : "current-password"
        case .code: "one-time-code"
        case .newPassword: "new-password"
        }
        let inputmode = field == .email ? " inputmode=\"email\"" : field == .code ? " inputmode=\"numeric\" maxlength=\"6\"" : ""
        // Passwords are never written back into the page.
        let value = field == .password || field == .newPassword ? "" : (screen.values[field] ?? "")
        let check: String
        if field == .code, screen.pending?.purpose != .reset {
            // Six digits sends the code — the whole form, as the button would.
            // (htmx can't parse a regular expression inside a trigger filter.)
            check = "hx-post=\"\(postPath)\" hx-trigger=\"input[this.value.length===6&amp;&amp;!isNaN(this.value)] changed\" hx-target=\"#\(id)\" hx-swap=\"outerHTML\" hx-indicator=\"#\(id)\""
        } else {
            // Leaving a box checks it; a box marked wrong is checked again as it's typed in.
            check = "hx-post=\"\(checkPath)\" hx-params=\"step,state,\(field.rawValue)\" hx-trigger=\"change, input[!document.getElementById('\(errorID(field))').hidden] changed delay:300ms\" hx-target=\"#\(errorID(field))\" hx-swap=\"outerHTML\" hx-indicator=\"#\(errorID(field))\""
        }
        return """
        <div class="bd-sign-in__field\(error == nil ? "" : " bd-sign-in__field--error")">\
        <input class="bd-sign-in__input\(field == .code ? " bd-sign-in__input--code" : "")" id="\(id)-\(field.rawValue)" name="\(field.rawValue)" \
        type="\(type)" autocomplete="\(autocomplete)"\(inputmode) placeholder="\(esc(label))" aria-label="\(esc(label))" \
        aria-describedby="\(errorID(field))" value="\(esc(value))"\(error == nil ? "" : " aria-invalid=\"true\"")\(screen.focus == field ? " autofocus" : "") \(check)>\
        \(errorSlot(field, error))</div>
        """
    }

    private static func texts(_ screen: Screen) -> (title: String, subtitle: String?, primary: String, hint: String?, links: [(go: String, label: String)]) {
        let name = screen.options.name?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
        switch screen.step {
        case .signIn:
            return (
                name.map { SignInWords.fill(SignInWords.signInTitle, ["name": $0]) } ?? SignInWords.signInTitleNoName,
                "Sign in to see your jobs and invoices.",
                SignInWords.signIn,
                nil,
                screen.options.password
                    ? [("forgot", SignInWords.forgotPassword), ("createAccount", SignInWords.noAccount)]
                    : []
            )
        case .createAccount:
            return (
                name.map { SignInWords.fill(SignInWords.createTitle, ["name": $0]) } ?? SignInWords.createTitleNoName,
                name.map { SignInWords.fill(SignInWords.createSubtitle, ["name": $0]) } ?? SignInWords.createSubtitleNoName,
                SignInWords.createAccount,
                SignInWords.passwordRule,
                [("signIn", SignInWords.haveAccount)]
            )
        case .forgot:
            return (SignInWords.forgotTitle, SignInWords.forgotSubtitle, SignInWords.sendCode, nil, [("signIn", SignInWords.backToSignIn)])
        case .code:
            let reset = screen.pending?.purpose == .reset
            return (
                SignInWords.codeTitle,
                SignInWords.fill(reset ? SignInWords.codeResetSubtitle : SignInWords.codeSubtitle, ["email": screen.pending?.email ?? ""]),
                SignInWords.confirm,
                reset ? SignInWords.passwordRule : nil,
                [("resend", SignInWords.resendCode), ("signIn", SignInWords.backToSignIn)]
            )
        }
    }

    private static func providers(_ screen: Screen) -> String {
        guard screen.step == .signIn || screen.step == .createAccount else { return "" }
        let offered = SignInProvider.allCases.filter(screen.options.oauth.contains)
        guard !offered.isEmpty else { return "" }
        let links = offered.map { provider in
            "<a class=\"bd-sign-in__provider bd-sign-in__provider--\(provider.rawValue)\" href=\"/api/bd-auth/customer/oauth/\(provider.rawValue)?returnTo=\(esc(accountPath(screen.next).uriComponent))\">\(mark(provider))<span>\(esc(SignInWords.continueWith(provider)))</span></a>"
        }
        return "<div class=\"bd-sign-in__providers\"><div class=\"bd-sign-in__divider\">\(SignInWords.or)</div>\(links.joined())</div>"
    }

    /// The whole screen: the element htmx swaps on each step.
    static func render(_ screen: Screen) -> String {
        let t = texts(screen)
        let names = fields(screen)
        var rows: [String] = []
        var index = 0
        while index < names.count {
            if names[index] == .firstName, index + 1 < names.count, names[index + 1] == .lastName {
                rows.append("<div class=\"bd-sign-in__row\">\(input(.firstName, screen))\(input(.lastName, screen))</div>")
                index += 2
                continue
            }
            rows.append(input(names[index], screen))
            index += 1
        }
        let style = SignInPalette(primary: screen.options.primaryColor, secondary: screen.options.secondaryColor)?.style ?? ""
        let logo = screen.options.logoURL.map { "<img class=\"bd-sign-in__logo\" src=\"\(esc($0))\" alt=\"\" onerror=\"this.hidden=true\">" } ?? ""
        let links = t.links.isEmpty ? "" : "<div class=\"bd-sign-in__links\">" + t.links.map {
            "<button type=\"submit\" name=\"go\" value=\"\($0.go)\" class=\"bd-sign-in__link\">\(esc($0.label))</button>"
        }.joined() + "</div>"
        return """
        <div class="bd-sign-in" id="\(id)" style="\(style)">\
        <form class="bd-sign-in__form" method="post" action="\(postPath)" novalidate \
        hx-post="\(postPath)" hx-target="#\(id)" hx-swap="outerHTML" hx-indicator="#\(id)" hx-disabled-elt="find .bd-sign-in__primary">\
        <input type="hidden" name="step" value="\(screen.step.rawValue)">\
        \(screen.sealed.map { "<input type=\"hidden\" name=\"state\" value=\"\(esc($0))\">" } ?? "")\
        \(screen.next.map { "<input type=\"hidden\" name=\"next\" value=\"\(esc($0))\">" } ?? "")\
        <fieldset class="bd-sign-in__fieldset">\
        <div class="bd-sign-in__header">\(logo)<h2 class="bd-sign-in__title">\(esc(t.title))</h2>\
        \(t.subtitle.map { "<p class=\"bd-sign-in__subtitle\">\(esc($0))</p>" } ?? "")</div>\
        <div class="bd-sign-in__body"><div class="bd-sign-in__body">\(rows.joined())\
        \(t.hint.map { "<p class=\"bd-sign-in__hint\">\(esc($0))</p>" } ?? "")</div>\
        \(problemSlot(screen.problem))\(noticeSlot(screen.notice))\
        <button type="submit" class="bd-sign-in__primary"><span class="bd-sign-in__label">\(esc(t.primary))</span><span class="bd-sign-in__spinner" aria-hidden="true"></span></button>\
        </div>\(links)\(providers(screen))</fieldset></form></div>
        """
    }

    /// An ISO 8601 instant, with or without fractional seconds.
    private static func instant(_ text: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: text) { return date }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: text)
    }

    /// The same marks the SDK's screen uses.
    private static func mark(_ provider: SignInProvider) -> String {
        switch provider {
        case .apple: appleMark
        case .google: googleMark
        case .github: githubMark
        case .discord: discordMark
        }
    }

    private static let appleMark = ##"<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.6 1.1 8.75.73 1.05 1.6 2.24 2.73 2.2 1.1-.05 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.4 1.2-2.46-.03-.01-2.3-.88-2.32-3.5zM14.2 6.13c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.3-.56.64-1.05 1.67-.92 2.66.97.08 1.96-.49 2.56-1.2z"/></svg>"##
    private static let githubMark = ##"<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.17 1.18a10.9 10.9 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z"/></svg>"##
    private static let discordMark = ##"<svg viewBox="0 0 24 24" aria-hidden="true" fill="#5865F2"><path d="M20.32 4.37A19.8 19.8 0 0 0 15.39 2.8a13.7 13.7 0 0 0-.63 1.29 18.4 18.4 0 0 0-5.52 0 13 13 0 0 0-.64-1.29 19.7 19.7 0 0 0-4.93 1.53C.53 9.05-.32 13.6.1 18.09a19.9 19.9 0 0 0 6.04 3.05c.49-.66.92-1.36 1.29-2.1a12.9 12.9 0 0 1-2.03-.97l.5-.38a14.2 14.2 0 0 0 12.2 0l.5.38c-.65.38-1.33.71-2.04.97.37.74.8 1.44 1.29 2.1a19.9 19.9 0 0 0 6.05-3.05c.5-5.2-.84-9.71-3.58-13.72zM8.02 15.33c-1.18 0-2.16-1.09-2.16-2.42s.96-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.33-.96 2.42-2.16 2.42zm7.96 0c-1.18 0-2.16-1.09-2.16-2.42s.96-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.33-.95 2.42-2.16 2.42z"/></svg>"##
    private static let googleMark = ##"<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.81z"/><path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.28a12 12 0 0 0 0 10.76l4.01-3.1z"/><path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.28 6.62l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77z"/></svg>"##
}
