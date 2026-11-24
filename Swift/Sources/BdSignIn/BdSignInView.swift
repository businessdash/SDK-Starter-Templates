import AuthenticationServices
import CryptoKit
import SwiftUI

/// Who the person is signing in to. They see the business, never BD.
public struct BdSignInBrand {
    /// Empty: the business's name as BD knows it.
    public var name: String
    /// Shown above the title, about 88 points square. A square image is clipped to a rounded square.
    /// nil: the business's logo as BD knows it.
    public var logo: Image?
    /// A line under the sign-in title.
    public var tagline: String?
    /// The main button and focus. nil: the business's primary colour from BD
    /// (Settings → Branding), else the app's tint.
    public var tint: Color?
    /// Links. nil: the business's secondary colour from BD, else `tint`.
    public var secondaryTint: Color?

    public init(name: String = "", logo: Image? = nil, tagline: String? = nil, tint: Color? = nil, secondaryTint: Color? = nil) {
        self.name = name
        self.logo = logo
        self.tagline = tagline
        self.tint = tint
        self.secondaryTint = secondaryTint
    }
}

/// Every word the screen shows. `%@` is the business's name.
public struct BdSignInStrings: Sendable {
    public var signInTitle = "Sign in to %@"
    public var createTitle = "Create your %@ account"
    public var createSubtitle = "Your account with %@. We'll email you a code to confirm it."
    /// The titles while there's no name to show (none given, and BD's not loaded yet).
    public var signInTitleNoName = "Sign in"
    public var createTitleNoName = "Create your account"
    public var createSubtitleNoName = "We'll email you a code to confirm it."
    public var forgotTitle = "Reset your password"
    public var forgotSubtitle = "Enter your email and we'll send you a code."
    public var codeTitle = "Check your email"
    public var codeSubtitle = "We sent a 6-digit code to %@."
    public var codeResetSubtitle = "We sent a 6-digit code to %@. Enter it with your new password."
    public var email = "Email"
    public var password = "Password"
    public var newPassword = "New password"
    public var firstName = "First name"
    public var lastName = "Last name"
    public var code = "6-digit code"
    public var passwordRule = "At least 10 characters."
    public var signIn = "Sign in"
    public var createAccount = "Create account"
    public var sendCode = "Send code"
    public var confirm = "Continue"
    public var resendCode = "Send a new code"
    public var codeResent = "A new code is on its way."
    public var forgotPassword = "Forgot password?"
    public var noAccount = "New here? Create an account"
    public var haveAccount = "Already have an account? Sign in"
    public var backToSignIn = "Back to sign in"
    public var or = "or"
    public var continueWithApple = "Continue with Apple"
    public var continueWithGoogle = "Continue with Google"
    public var continueWithGitHub = "Continue with GitHub"
    public var continueWithDiscord = "Continue with Discord"
    public var enterEmail = "Enter your email."
    public var invalidEmail = "Enter a full email address, like name@example.com."
    public var enterPassword = "Enter your password."
    public var enterCode = "Enter the 6-digit code from the email."
    public var passwordTooShort = "Use at least 10 characters for your password."
    public var passwordTooLong = "Use 256 characters or fewer for your password."
    public var nameTooLong = "Use 100 characters or fewer."

    public init() {}
}

/// Where the screen opens.
public enum BdSignInStart: Sendable {
    case signIn, createAccount
}

/// Gets a Google ID token with the app's own Google sign-in (Google's SDK, or
/// Credential Manager on Android). Return the raw nonce if you set one.
public typealias BdGoogleIDToken = @MainActor () async throws -> (idToken: String, nonce: String?)

/// Native sign-in for a business's customers: email and password, a new
/// account confirmed by an emailed code, a forgotten password reset by code,
/// and "Continue with Apple / Google / GitHub / Discord" — WorkOS underneath
/// all of it, through BD, the same accounts as BD's hosted sign-in.
///
/// Apple uses Apple's own sheet when the business listed the app (and Google
/// the app's own Google sign-in, when `google` is given); every other provider
/// opens in the system's sign-in sheet (`ASWebAuthenticationSession`) and
/// comes back to `oauthCallbackScheme`.
///
/// In the business's colours (Settings → Branding in BD) and with its logo
/// unless `brand` says otherwise. Each box is checked when the person leaves
/// it, once they've typed in it, and every box when they press the button;
/// what's wrong shows under the box and nothing is sent until it's right.
///
/// ```swift
/// BdSignInView(
///     brand: BdSignInBrand(logo: Image("Logo")),   // the name comes from BD
///     backend: BdServerSignInBackend.businessDash(publishableKey: "pk_…"),
///     oauthCallbackScheme: "bdstarter"
/// ) { session in
///     store(session.sessionToken)
/// }
/// ```
public struct BdSignInView<Backend: BdSignInBackend>: View {
    private let brand: BdSignInBrand
    private let backend: Backend
    private let strings: BdSignInStrings
    private let google: BdGoogleIDToken?
    private let oauthCallbackScheme: String?
    private let onSignedIn: (Backend.Session) -> Void

    /// `verify`: WorkOS wants the email confirmed before a password sign-in.
    private enum Purpose: Equatable { case signUp, reset, verify }
    private enum Step: Equatable {
        case signIn, createAccount, forgot
        case code(BdCodeSent, Purpose, email: String)
    }
    private typealias Field = BdSignInBox

    @State private var step: Step
    @State private var options = BdSignInOptions()
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var email = ""
    @State private var password = ""
    @State private var code = ""
    @State private var newPassword = ""
    @State private var busy = false
    /// What's wrong with each box, shown under it.
    @State private var errors: [Field: String] = [:]
    /// Boxes typed in since the step began — leaving an untouched box says nothing.
    @State private var edited: Set<Field> = []
    /// A problem that isn't one box's: wrong password, offline, too many tries.
    @State private var problem: String?
    @State private var notice: String?
    @State private var appleNonce = ""
    @FocusState private var focus: Field?
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.self) private var environment
    @Environment(\.webAuthenticationSession) private var webAuthenticationSession

    public init(
        brand: BdSignInBrand,
        backend: Backend,
        start: BdSignInStart = .signIn,
        strings: BdSignInStrings = BdSignInStrings(),
        google: BdGoogleIDToken? = nil,
        oauthCallbackScheme: String? = nil,
        onSignedIn: @escaping (Backend.Session) -> Void
    ) {
        self.brand = brand
        self.backend = backend
        self.strings = strings
        self.google = google
        self.oauthCallbackScheme = oauthCallbackScheme
        self.onSignedIn = onSignedIn
        _step = State(initialValue: start == .createAccount ? .createAccount : .signIn)
    }

    public var body: some View {
        ScrollView {
            VStack(spacing: 28) {
                header
                VStack(spacing: 14) {
                    fields
                    if let problem {
                        Label(problem, systemImage: "exclamationmark.circle.fill")
                            .font(.footnote)
                            .foregroundStyle(.red)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .transition(.opacity)
                    }
                    if let notice {
                        Label(notice, systemImage: "checkmark.circle.fill")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    primaryButton
                }
                links
                if step == .signIn || step == .createAccount { providers }
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 32)
            .frame(maxWidth: 460)
            .frame(maxWidth: .infinity)
            .animation(.snappy, value: step)
            .animation(.snappy, value: problem)
        }
        .scrollDismissesKeyboard(.interactively)
        .tint(accent)
        .disabled(busy)
        .onChange(of: focus) { left, _ in
            if let left { leave(left) }
        }
        .onChange(of: firstName) { typed(.firstName) }
        .onChange(of: lastName) { typed(.lastName) }
        .onChange(of: email) { typed(.email) }
        .onChange(of: password) { typed(.password) }
        .onChange(of: newPassword) { typed(.newPassword) }
        .task {
            if let loaded = try? await backend.options() { options = loaded }
        }
    }

    // MARK: Colours

    /// BD's colours for the business, used where `brand` gives none.
    private var palette: BdSignInPalette? {
        BdSignInPalette(primary: options.primaryColor, secondary: options.secondaryColor)
    }

    /// The main button: the brand's tint, else the business's primary, else the app's tint.
    private var accent: Color? { brand.tint ?? palette?.accent }

    /// Text on the main button, readable on `accent`.
    private var onAccent: Color? {
        if let tint = brand.tint { return BdSignInPalette.foreground(on: tint, in: environment) }
        return palette?.onAccent
    }

    /// Links: the brand's secondary, else (with no brand tint) the business's
    /// secondary made legible, else the accent.
    private var linkColor: Color? {
        if let secondary = brand.secondaryTint { return secondary }
        if brand.tint != nil { return brand.tint }
        return palette?.link(colorScheme)
    }

    // MARK: Parts

    private var header: some View {
        VStack(spacing: 14) {
            if let logo = brand.logo {
                Self.logoFrame(logo.resizable())
            } else if let url = options.logoUrl.flatMap(URL.init(string:)) {
                // Shown once it loads; a logo that fails is left out, not drawn broken.
                AsyncImage(url: url) { phase in
                    if let image = phase.image { Self.logoFrame(image.resizable()) }
                }
            }
            Text(title)
                .font(.title2.weight(.bold))
                .multilineTextAlignment(.center)
            if let subtitle {
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private static func logoFrame(_ image: Image) -> some View {
        image
            .scaledToFill()
            .frame(width: 88, height: 88)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .shadow(color: .black.opacity(0.18), radius: 10, y: 4)
            .accessibilityHidden(true)
    }

    /// The brand's name, or BD's for the business when the brand leaves it empty.
    private var businessName: String? {
        let given = brand.name.trimmingCharacters(in: .whitespacesAndNewlines)
        if !given.isEmpty { return given }
        let fromBD = options.name?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return fromBD.isEmpty ? nil : fromBD
    }

    private var title: String {
        switch step {
        case .signIn: businessName.map { String(format: strings.signInTitle, $0) } ?? strings.signInTitleNoName
        case .createAccount: businessName.map { String(format: strings.createTitle, $0) } ?? strings.createTitleNoName
        case .forgot: strings.forgotTitle
        case .code: strings.codeTitle
        }
    }

    private var subtitle: String? {
        switch step {
        case .signIn: brand.tagline
        case .createAccount: businessName.map { String(format: strings.createSubtitle, $0) } ?? strings.createSubtitleNoName
        case .forgot: strings.forgotSubtitle
        case .code(_, let purpose, let email):
            String(format: purpose == .reset ? strings.codeResetSubtitle : strings.codeSubtitle, email)
        }
    }

    @ViewBuilder private var fields: some View {
        switch step {
        case .signIn:
            emailField(next: .password)
            passwordField(strings.password, text: $password, field: .password, isNew: false)
        case .createAccount:
            HStack(alignment: .top, spacing: 10) {
                checked(.firstName) {
                    BdSignInField(title: strings.firstName, text: $firstName, invalid: errors[.firstName] != nil)
                        .textContentType(.givenName)
                        .focused($focus, equals: .firstName)
                        .submitLabel(.next)
                        .onSubmit { focus = .lastName }
                }
                checked(.lastName) {
                    BdSignInField(title: strings.lastName, text: $lastName, invalid: errors[.lastName] != nil)
                        .textContentType(.familyName)
                        .focused($focus, equals: .lastName)
                        .submitLabel(.next)
                        .onSubmit { focus = .email }
                }
            }
            emailField(next: .password)
            passwordField(strings.password, text: $password, field: .password, isNew: true)
            passwordRule(for: .password)
        case .forgot:
            emailField(next: nil)
        case .code(_, let purpose, _):
            checked(.code) {
                BdSignInField(title: strings.code, text: $code, invalid: errors[.code] != nil)
                    .textContentType(.oneTimeCode)
                    .font(.title3.monospacedDigit().weight(.semibold))
                    .focused($focus, equals: .code)
                    #if os(iOS)
                    .keyboardType(.numberPad)
                    #endif
                    .onChange(of: code) { _, typed in
                        let digits = String(typed.filter(\.isASCII).filter(\.isNumber).prefix(6))
                        if digits != typed { code = digits; return }
                        self.typed(.code)
                        if digits.count == 6, purpose != .reset { submit() }
                    }
            }
            if purpose == .reset {
                passwordField(strings.newPassword, text: $newPassword, field: .newPassword, isNew: true)
                passwordRule(for: .newPassword)
            }
        }
    }

    /// A box with what's wrong with it underneath, in red, read out with it.
    private func checked(_ field: Field, @ViewBuilder box: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            box()
                .accessibilityHint(errors[field] ?? "")
            if let error = errors[field] {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .transition(.opacity)
            }
        }
    }

    /// The new-password rule — left out while the box's own error says the same.
    @ViewBuilder private func passwordRule(for field: Field) -> some View {
        if errors[field] == nil {
            Text(strings.passwordRule)
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func emailField(next: Field?) -> some View {
        checked(.email) {
            BdSignInField(title: strings.email, text: $email, invalid: errors[.email] != nil)
                .textContentType(.username)
                #if os(iOS)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                #endif
                .autocorrectionDisabled()
                .focused($focus, equals: .email)
                .submitLabel(next == nil ? .go : .next)
                .onSubmit { if let next { focus = next } else { submit() } }
        }
    }

    private func passwordField(_ title: String, text: Binding<String>, field: Field, isNew: Bool) -> some View {
        checked(field) {
            BdSignInField(title: title, text: text, secure: true, invalid: errors[field] != nil)
                .textContentType(isNew ? .newPassword : .password)
                .focused($focus, equals: field)
                .submitLabel(.go)
                .onSubmit(submit)
        }
    }

    private var primaryButton: some View {
        Button(action: submit) {
            ZStack {
                Text(primaryTitle).opacity(busy ? 0 : 1)
                if busy { ProgressView().tint(onAccent) }
            }
            .foregroundStyle(onAccent ?? .white)
            .font(.headline)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
        }
        .buttonStyle(.borderedProminent)
        .buttonBorderShape(.roundedRectangle(radius: 12))
        .controlSize(.large)
    }

    private var primaryTitle: String {
        switch step {
        case .signIn: strings.signIn
        case .createAccount: strings.createAccount
        case .forgot: strings.sendCode
        case .code: strings.confirm
        }
    }

    @ViewBuilder private var links: some View {
        VStack(spacing: 14) {
            switch step {
            case .signIn:
                if options.password {
                    link(strings.forgotPassword) { go(.forgot) }
                    link(strings.noAccount) { go(.createAccount) }
                }
            case .createAccount:
                link(strings.haveAccount) { go(.signIn) }
            case .forgot:
                link(strings.backToSignIn) { go(.signIn) }
            case .code:
                link(strings.resendCode, action: resend)
                link(strings.backToSignIn) { go(.signIn) }
            }
        }
        .font(.subheadline.weight(.medium))
        .tint(linkColor ?? accent)
    }

    private func link(_ title: String, action: @escaping () -> Void) -> some View {
        Button(title, action: action).buttonStyle(.borderless)
    }

    /// A provider's button, and how it signs in.
    private enum ProviderButton: Identifiable {
        case appleSheet
        case googleToken
        case link(BdOAuthProvider)

        var id: String {
            switch self {
            case .appleSheet: "apple"
            case .googleToken: "google"
            case .link(let provider): provider.rawValue
            }
        }
    }

    /// Apple, Google, GitHub, Discord — each the phone's own sheet where it can
    /// be, else a link through WorkOS (when the app gave a callback scheme).
    private var providerButtons: [ProviderButton] {
        let links = oauthCallbackScheme == nil ? [] : options.oauthProviders
        return BdOAuthProvider.allCases.compactMap { provider in
            switch provider {
            case .apple where options.apple: .appleSheet
            case .google where options.google && google != nil: .googleToken
            default: links.contains(provider) ? .link(provider) : nil
            }
        }
    }

    @ViewBuilder private var providers: some View {
        let buttons = providerButtons
        if !buttons.isEmpty {
            VStack(spacing: 12) {
                HStack(spacing: 12) {
                    Rectangle().fill(.separator).frame(height: 1)
                    Text(strings.or).font(.footnote).foregroundStyle(.secondary)
                    Rectangle().fill(.separator).frame(height: 1)
                }
                ForEach(buttons) { button in
                    switch button {
                    case .appleSheet:
                        SignInWithAppleButton(step == .createAccount ? .signUp : .signIn) { request in
                            appleNonce = Self.randomNonce()
                            request.requestedScopes = [.fullName, .email]
                            request.nonce = Self.sha256(appleNonce)
                        } onCompletion: { result in
                            apple(result)
                        }
                        .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
                        .frame(height: 50)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    case .googleToken:
                        providerButton(strings.continueWithGoogle, action: signInWithGoogle)
                    case .link(let provider):
                        providerButton(label(for: provider)) { continueWith(provider) }
                    }
                }
            }
        }
    }

    private func label(for provider: BdOAuthProvider) -> String {
        switch provider {
        case .apple: strings.continueWithApple
        case .google: strings.continueWithGoogle
        case .github: strings.continueWithGitHub
        case .discord: strings.continueWithDiscord
        }
    }

    private func providerButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.headline)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
        }
        .buttonStyle(.bordered)
        .buttonBorderShape(.roundedRectangle(radius: 12))
        .controlSize(.large)
        .tint(.primary)
    }

    // MARK: Actions

    private func go(_ next: Step) {
        problem = nil
        notice = nil
        errors = [:]
        code = ""
        newPassword = ""
        step = next
        edited = []
        focus = switch next {
        case .createAccount: .firstName
        case .code: .code
        default: .email
        }
    }

    private var cleanEmail: String { email.trimmingCharacters(in: .whitespacesAndNewlines) }

    /// The boxes this step shows, in order.
    private var shownFields: [Field] {
        switch step {
        case .signIn: [.email, .password]
        case .createAccount: [.firstName, .lastName, .email, .password]
        case .forgot: [.email]
        case .code(_, let purpose, _): purpose == .reset ? [.code, .newPassword] : [.code]
        }
    }

    private func value(_ field: Field) -> String {
        switch field {
        case .firstName: firstName
        case .lastName: lastName
        case .email: email
        case .password: password
        case .code: code
        case .newPassword: newPassword
        }
    }

    private func check(_ field: Field) -> String? {
        BdSignInChecks.problem(field, value(field), newPassword: step != .signIn, strings: strings)
    }

    /// Typed in: remembered, and a box already marked wrong is re-checked so
    /// its message goes the moment it's right (and never appears early).
    private func typed(_ field: Field) {
        edited.insert(field)
        if errors[field] != nil { errors[field] = check(field) }
    }

    /// Left a box: check it, if it was typed in.
    private func leave(_ field: Field) {
        guard edited.contains(field), shownFields.contains(field) else { return }
        errors[field] = check(field)
    }

    /// Every box on the step. False, with the first wrong box focused, when any is wrong.
    private func checkAll() -> Bool {
        var found: [Field: String] = [:]
        for field in shownFields {
            if let message = check(field) { found[field] = message }
        }
        errors = found
        if let first = shownFields.first(where: { found[$0] != nil }) {
            focus = first
            return false
        }
        return true
    }

    private func submit() {
        guard !busy else { return }
        problem = nil
        notice = nil
        guard checkAll() else { return }
        switch step {
        case .signIn:
            let to = cleanEmail
            run {
                switch try await backend.signIn(email: to, password: password) {
                case .signedIn(let session): onSignedIn(session)
                // WorkOS wants the email confirmed; it has sent a code.
                case .confirmEmail(let sent): go(.code(sent, .verify, email: to))
                }
            }
        case .createAccount:
            run {
                let sent = try await backend.startSignUp(email: cleanEmail, password: password,
                                                         firstName: Self.clean(firstName), lastName: Self.clean(lastName))
                go(.code(sent, .signUp, email: cleanEmail))
            }
        case .forgot:
            run {
                let sent = try await backend.startReset(email: cleanEmail)
                go(.code(sent, .reset, email: cleanEmail))
            }
        case .code(let sent, let purpose, _):
            run {
                onSignedIn(try await backend.verify(pendingId: sent.pendingId, code: code,
                                                    newPassword: purpose == .reset ? newPassword : nil))
            }
        }
    }

    private func resend() {
        guard case .code(_, let purpose, let to) = step else { return }
        problem = nil
        run {
            let sent: BdCodeSent
            switch purpose {
            case .signUp:
                sent = try await backend.startSignUp(email: to, password: password, firstName: Self.clean(firstName), lastName: Self.clean(lastName))
            case .reset:
                sent = try await backend.startReset(email: to)
            case .verify:
                switch try await backend.signIn(email: to, password: password) {
                case .signedIn(let session):
                    onSignedIn(session)
                    return
                case .confirmEmail(let next):
                    sent = next
                }
            }
            step = .code(sent, purpose, email: to)
            code = ""
            errors[.code] = nil
            notice = strings.codeResent
        }
    }

    private func apple(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .failure(let error):
            if (error as? ASAuthorizationError)?.code != .canceled { problem = error.localizedDescription }
        case .success(let authorization):
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let tokenData = credential.identityToken,
                  let token = String(data: tokenData, encoding: .utf8) else {
                problem = BdSignInError.unavailable.message
                return
            }
            let nonce = appleNonce
            // Apple gives the name on the first sign-in only.
            let first = credential.fullName?.givenName
            let last = credential.fullName?.familyName
            run { onSignedIn(try await backend.signIn(provider: .apple, idToken: token, nonce: nonce, firstName: first, lastName: last)) }
        }
    }

    private func signInWithGoogle() {
        guard let google else { return }
        run {
            let (token, nonce) = try await google()
            onSignedIn(try await backend.signIn(provider: .google, idToken: token, nonce: nonce, firstName: nil, lastName: nil))
        }
    }

    /// "Continue with …" in the system's sign-in sheet: WorkOS's link for the
    /// provider, back to the app's scheme with a code only this sign-in (its
    /// PKCE verifier) can redeem.
    private func continueWith(_ provider: BdOAuthProvider) {
        guard let scheme = oauthCallbackScheme else { return }
        problem = nil
        run {
            let verifier = Self.randomVerifier()
            let start = try await backend.startOAuth(
                provider: provider,
                redirectURI: "\(scheme)://oauth",
                codeChallenge: Self.challenge(for: verifier)
            )
            let back: URL
            do {
                back = try await webAuthenticationSession.authenticate(
                    using: start,
                    callback: .customScheme(scheme),
                    preferredBrowserSession: .shared,
                    additionalHeaderFields: [:]
                )
            } catch let error as ASWebAuthenticationSessionError where error.code == .canceledLogin {
                return
            }
            let items = URLComponents(url: back, resolvingAgainstBaseURL: false)?.queryItems ?? []
            let value = { (name: String) in items.first(where: { $0.name == name })?.value }
            if let code = value("bd_oauth_code") {
                onSignedIn(try await backend.finishOAuth(code: code, codeVerifier: verifier))
            } else if value("bd_oauth_error") != "cancelled" {
                throw BdSignInError(
                    code: "oauth_failed",
                    message: value("bd_oauth_message") ?? "Sign-in didn't finish. Try again."
                )
            }
        }
    }

    private func run(_ work: @escaping @MainActor () async throws -> Void) {
        busy = true
        Task { @MainActor in
            defer { busy = false }
            do {
                try await work()
            } catch is CancellationError {
            } catch let error as BdSignInError {
                if let field = BdSignInChecks.box(for: error, among: shownFields) {
                    errors[field] = error.message
                    focus = field
                } else {
                    problem = error.message
                }
            } catch {
                problem = error.localizedDescription
            }
        }
    }

    // MARK: Helpers

    private static func clean(_ text: String) -> String? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private static func randomNonce() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return bytes.map { String(format: "%02x", $0) }.joined()
    }

    private static func sha256(_ text: String) -> String {
        SHA256.hash(data: Data(text.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    private static func base64URL(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    /// A PKCE verifier (RFC 7636): 32 random bytes, base64url.
    private static func randomVerifier() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return base64URL(Data(bytes))
    }

    /// Its S256 challenge.
    private static func challenge(for verifier: String) -> String {
        base64URL(Data(SHA256.hash(data: Data(verifier.utf8))))
    }
}

/// One text box: a label inside a soft rounded field, edged in red when wrong.
struct BdSignInField: View {
    let title: String
    @Binding var text: String
    var secure = false
    var invalid = false

    var body: some View {
        Group {
            if secure {
                SecureField(title, text: $text)
            } else {
                TextField(title, text: $text)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
        .background(.fill.tertiary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay {
            if invalid {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(.red, lineWidth: 1)
            }
        }
    }
}
