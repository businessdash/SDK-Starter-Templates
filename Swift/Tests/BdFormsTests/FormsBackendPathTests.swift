import Foundation
import Testing
@testable import BdForms

/// A form slug is one path segment, whatever is in it (encodeURIComponent).
@Suite struct FormsBackendPathTests {
    let backend = BdPackageFormsBackend(host: URL(string: "https://bd.test")!, publishableKey: "pk_test_123")

    @Test func aSlashInTheSlugStaysInOneSegment() {
        let url = backend.url("team/intake", "schedule-slots")
        #expect(url.absoluteString == "https://bd.test/api/package/v1/forms/team%2Fintake/schedule-slots")
    }

    @Test func aPlainSlugIsUnchanged() {
        #expect(backend.url("contact").absoluteString == "https://bd.test/api/package/v1/forms/contact")
    }
}
