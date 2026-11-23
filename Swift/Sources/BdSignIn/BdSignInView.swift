import AuthenticationServices
import CryptoKit
import SwiftUI

/// Who the person is signing in to. They see the business, never BD.
public struct BdSignInBrand {
    public var name: String
    /// Shown above the title, about 88 points square. A square image is clipped to a rounded square.
    public var logo: Image?
    /// A line under the sign-in title.
    public var tagline: String?
    /// Buttons and links. nil: the app's tint.
    public var tint: Color?

    public init(name: String, logo: Image? = nil, tagline: String? = nil, tint: Color? = nil) {
        self.name = name
        self.logo = logo
        self.tagline = tagline
        self.tint = tint
    }
}

/// Every word the screen shows. `%@` is the business's name.
public struct BdSignInStrings: Sendable {
    public var signInTitle = "Sign in to %@"
    public var createTitle = "Create your %@ account"
    public var createSubtitle = "An account just for %@, with its own password."
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
    public var continueWithGoogle = "Continue with Google"
    public var enterEmail = "Enter your email."
    public var enterPassword = "Enter your password."
    public var enterCode = "Enter the 6-digit code from the email."
    public var passwordTooShort = "Use at least 10 characters for your password."

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
/// and Sign in with Apple or Google where the business has set them up.
///
/// ```swift
/// BdSignInView(
///     brand: BdSignInBrand(name: "Acme", logo: Image("Logo")),
///     backend: BdServerSignInBackend<MySession>(baseURL: URL(string: "https://acme.com/api/account")!)
/// ) { session in
///     store(session)
/// }
/// ```
public struct BdSignInView<Backend: BdSignInBackend>: View {
    private let brand: BdSignInBrand
    private let backend: Backend
    private let strings: BdSignInStrings
    private let google: BdGoogleIDToken?
    private let onSignedIn: (Backend.Session) -> Void

    private enum Purpose: Equatable { case signUp, reset }
    private enum Step: Equatable {
        case signIn, createAccount, forgot
        case code(BdCodeSent, Purpose, email: String)
    }
    private enum Field: Hashable { case firstName, lastName, email, password, code, newPassword }

    @State private var step: Step
    @State private var options = BdSignInOptions()
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var email = ""
    @State private var password = ""
    @State private var code = ""
    @State private var newPassword = ""
    @State private var busy = false
    @State private var problem: String?
    @State private var notice: String?
    @State private var appleNonce = ""
    @FocusState private var focus: Field?
    @Environment(\.colorScheme) private var colorScheme

    public init(
        brand: BdSignInBrand,
        backend: Backend,
        start: BdSignInStart = .signIn,
        strings: BdSignInStrings = BdSignInStrings(),
        google: BdGoogleIDToken? = nil,
        onSignedIn: @escaping (Backend.Session) -> Void
    ) {
        self.brand = brand
        self.backend = backend
        self.strings = strings
        self.google = google
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
        .tint(brand.tint)
        .disabled(busy)
        .task {
            if let loaded = try? await backend.options() { options = loaded }
        }
    }

    // MARK: Parts

    private var header: some View {
        VStack(spacing: 14) {
            if let logo = brand.logo {
                logo
                    .resizable()
                    .scaledToFill()
                    .frame(width: 88, height: 88)
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                    .shadow(color: .black.opacity(0.18), radius: 10, y: 4)
                    .accessibilityHidden(true)
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

    private var title: String {
        switch step {
        case .signIn: String(format: strings.signInTitle, brand.name)
        case .createAccount: String(format: strings.createTitle, brand.name)
        case .forgot: strings.forgotTitle
        case .code: strings.codeTitle
        }
    }

    private var subtitle: String? {
        switch step {
        case .signIn: brand.tagline
        case .createAccount: String(format: strings.createSubtitle, brand.name)
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
            HStack(spacing: 10) {
                BdSignInField(title: strings.firstName, text: $firstName)
                    .textContentType(.givenName)
                    .focused($focus, equals: .firstName)
                    .submitLabel(.next)
                    .onSubmit { focus = .lastName }
                BdSignInField(title: strings.lastName, text: $lastName)
                    .textContentType(.familyName)
                    .focused($focus, equals: .lastName)
                    .submitLabel(.next)
                    .onSubmit { focus = .email }
            }
            emailField(next: .password)
            passwordField(strings.password, text: $password, field: .password, isNew: true)
            Text(strings.passwordRule)
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        case .forgot:
            emailField(next: nil)
        case .code(_, let purpose, _):
            BdSignInField(title: strings.code, text: $code)
                .textContentType(.oneTimeCode)
                .font(.title3.monospacedDigit().weight(.semibold))
                .focused($focus, equals: .code)
                #if os(iOS)
                .keyboardType(.numberPad)
                #endif
                .onChange(of: code) { _, typed in
                    let digits = String(typed.filter(\.isNumber).prefix(6))
                    if digits != typed { code = digits }
                    if digits.count == 6, purpose == .signUp { submit() }
                }
            if purpose == .reset {
                passwordField(strings.newPassword, text: $newPassword, field: .newPassword, isNew: true)
                Text(strings.passwordRule)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private func emailField(next: Field?) -> some View {
        BdSignInField(title: strings.email, text: $email)
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

    private func passwordField(_ title: String, text: Binding<String>, field: Field, isNew: Bool) -> some View {
        BdSignInField(title: title, text: text, secure: true)
            .textContentType(isNew ? .newPassword : .password)
            .focused($focus, equals: field)
            .submitLabel(.go)
            .onSubmit(submit)
    }

    private var primaryButton: some View {
        Button(action: submit) {
            ZStack {
                Text(primaryTitle).opacity(busy ? 0 : 1)
                if busy { ProgressView() }
            }
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
    }

    private func link(_ title: String, action: @escaping () -> Void) -> some View {
        Button(title, action: action).buttonStyle(.borderless)
    }

    @ViewBuilder private var providers: some View {
        let showsGoogle = options.google && google != nil
        if options.apple || showsGoogle {
            VStack(spacing: 12) {
                HStack(spacing: 12) {
                    Rectangle().fill(.separator).frame(height: 1)
                    Text(strings.or).font(.footnote).foregroundStyle(.secondary)
                    Rectangle().fill(.separator).frame(height: 1)
                }
                if options.apple {
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
                }
                if showsGoogle {
                    Button(action: signInWithGoogle) {
                        Text(strings.continueWithGoogle)
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 6)
                    }
                    .buttonStyle(.bordered)
                    .buttonBorderShape(.roundedRectangle(radius: 12))
                    .controlSize(.large)
                }
            }
        }
    }

    // MARK: Actions

    private func go(_ next: Step) {
        problem = nil
        notice = nil
        code = ""
        newPassword = ""
        step = next
        focus = switch next {
        case .createAccount: .firstName
        case .code: .code
        default: .email
        }
    }

    private var cleanEmail: String { email.trimmingCharacters(in: .whitespacesAndNewlines) }

    private func submit() {
        guard !busy else { return }
        problem = nil
        notice = nil
        switch step {
        case .signIn:
            guard !cleanEmail.isEmpty else { return fail(strings.enterEmail, focus: .email) }
            guard !password.isEmpty else { return fail(strings.enterPassword, focus: .password) }
            run { onSignedIn(try await backend.signIn(email: cleanEmail, password: password)) }
        case .createAccount:
            guard !cleanEmail.isEmpty else { return fail(strings.enterEmail, focus: .email) }
            guard password.count >= 10 else { return fail(strings.passwordTooShort, focus: .password) }
            run {
                let sent = try await backend.startSignUp(email: cleanEmail, password: password,
                                                         firstName: Self.clean(firstName), lastName: Self.clean(lastName))
                go(.code(sent, .signUp, email: cleanEmail))
            }
        case .forgot:
            guard !cleanEmail.isEmpty else { return fail(strings.enterEmail, focus: .email) }
            run {
                let sent = try await backend.startReset(email: cleanEmail)
                go(.code(sent, .reset, email: cleanEmail))
            }
        case .code(let sent, let purpose, _):
            guard code.count == 6 else { return fail(strings.enterCode, focus: .code) }
            if purpose == .reset, newPassword.count < 10 { return fail(strings.passwordTooShort, focus: .newPassword) }
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
            let sent = purpose == .signUp
                ? try await backend.startSignUp(email: to, password: password, firstName: Self.clean(firstName), lastName: Self.clean(lastName))
                : try await backend.startReset(email: to)
            step = .code(sent, purpose, email: to)
            code = ""
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

    private func fail(_ message: String, focus field: Field) {
        problem = message
        focus = field
    }

    private func run(_ work: @escaping @MainActor () async throws -> Void) {
        busy = true
        Task { @MainActor in
            defer { busy = false }
            do {
                try await work()
            } catch is CancellationError {
            } catch let error as BdSignInError {
                problem = error.message
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
}

/// One text box: a label inside a soft rounded field.
struct BdSignInField: View {
    let title: String
    @Binding var text: String
    var secure = false

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
    }
}
