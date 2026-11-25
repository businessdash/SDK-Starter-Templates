// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "BusinessDashKit",
    platforms: [.iOS(.v26), .macOS(.v26)],
    products: [
        // The data layer. No dependencies — the BD Package API is plain REST
        // with a bearer key, so URLSession + Codable covers all of it.
        .library(name: "BusinessDashKit", targets: ["BusinessDashKit"]),
        // SwiftUI screens built on BusinessDashKit. A LIBRARY, not an app target:
        // SwiftPM can't build an iOS app bundle, so the starter app is an
        // Xcode project that imports this. It still compiles under
        // `swift build` on macOS, which is what keeps it honest.
        .library(name: "BdStarterApp", targets: ["BdStarterApp"]),
        // Native form renderer: BD forms as SwiftUI, with BD's conditions,
        // validation, calculations and submission. Depends on nothing — not
        // even BusinessDashKit — so any app can embed it, including one that
        // already has a module of that name.
        .library(name: "BdForms", targets: ["BdForms"]),
        // Native sign-in for a business's customers, in the business's own
        // brand: email and password, codes by email, Sign in with Apple and
        // Google. Depends on nothing; talks to BD with the publishable key,
        // or through the app's own server.
        .library(name: "BdSignIn", targets: ["BdSignIn"])
    ],
    targets: [
        .target(
            name: "BusinessDashKit",
            swiftSettings: [.swiftLanguageMode(.v6)]
        ),
        .target(
            name: "BdForms",
            swiftSettings: [.swiftLanguageMode(.v6)]
        ),
        .target(
            name: "BdSignIn",
            swiftSettings: [.swiftLanguageMode(.v6)]
        ),
        .target(
            name: "BdStarterApp",
            dependencies: ["BusinessDashKit", "BdForms", "BdSignIn"],
            swiftSettings: [.swiftLanguageMode(.v6)]
        ),
        .testTarget(
            name: "BusinessDashKitTests",
            dependencies: ["BusinessDashKit"],
            // post-html-parity.json is read by path in PostHtmlTests.
            exclude: ["Fixtures"],
            swiftSettings: [.swiftLanguageMode(.v6)]
        ),
        .testTarget(
            // Screens laid out from BdStarterApp's public parts, as an app would.
            name: "BdStarterAppTests",
            dependencies: ["BdStarterApp", "BusinessDashKit"],
            swiftSettings: [.swiftLanguageMode(.v6)]
        ),
        .testTarget(
            name: "BdSignInTests",
            dependencies: ["BdSignIn"],
            swiftSettings: [.swiftLanguageMode(.v6)]
        ),
        .testTarget(
            name: "BdFormsTests",
            dependencies: ["BdForms"],
            resources: [.copy("Fixtures")],
            swiftSettings: [.swiftLanguageMode(.v6)]
        )
    ]
)
