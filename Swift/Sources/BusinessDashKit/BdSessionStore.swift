import Foundation
import Security

/// Owns the two per-device identifiers this kit needs, and keeps them in the
/// right place for what they are.
///
/// * The **session token** is a credential — Keychain, with
///   `kSecAttrAccessibleAfterFirstUnlock` so a background refresh works but
///   the token isn't readable before the device is first unlocked.
/// * The **cart visitor token** is not a secret, just an opaque id that ties a
///   device to a cart. `UserDefaults` is correct for it, and putting it in the
///   Keychain would be cargo-culting.
///
/// An `actor` because both values are mutable process-wide state read from
/// several screens. Keychain calls are synchronous C APIs, which is fine
/// inside an actor — they don't suspend, so there is no reentrancy window
/// between the read and the write.
public actor BdSessionStore {
    private let service: String
    private let account = "bd.session-token"
    private let visitorDefaultsKey = "bd.cart-visitor-token"
    private let defaults: UserDefaults

    public init(service: String = "app.bd.session", defaults: UserDefaults = .standard) {
        self.service = service
        self.defaults = defaults
    }

    // MARK: - Session token

    public func sessionToken() -> String? {
        var query = baseQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    public func setSessionToken(_ token: String) {
        let data = Data(token.utf8)

        // Update-then-add rather than delete-then-add: a crash between a
        // delete and an add would sign the customer out for no reason.
        let updated = SecItemUpdate(
            baseQuery() as CFDictionary,
            [kSecValueData as String: data] as CFDictionary
        )
        if updated == errSecSuccess { return }

        var query = baseQuery()
        query[kSecValueData as String] = data
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(query as CFDictionary, nil)
    }

    public func clearSessionToken() {
        SecItemDelete(baseQuery() as CFDictionary)
    }

    // MARK: - Cart visitor token

    /// Stable per-install id. Generated locally — there is no endpoint that
    /// mints one, and the platform keys the cart on whatever it receives.
    public func visitorToken() -> String {
        if let existing = defaults.string(forKey: visitorDefaultsKey) { return existing }
        let token = UUID().uuidString
        defaults.set(token, forKey: visitorDefaultsKey)
        return token
    }

    // MARK: - Internals

    private func baseQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
    }
}
