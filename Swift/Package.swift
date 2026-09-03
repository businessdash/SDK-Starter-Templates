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
        .library(name: "BdStarterApp", targets: ["BdStarterApp"])
    ],
    targets: [
        .target(
            name: "BusinessDashKit",
            swiftSettings: [.swiftLanguageMode(.v6)]
        ),
        .target(
            name: "BdStarterApp",
            dependencies: ["BusinessDashKit"],
            swiftSettings: [.swiftLanguageMode(.v6)]
        ),
        .testTarget(
            name: "BusinessDashKitTests",
            dependencies: ["BusinessDashKit"],
            swiftSettings: [.swiftLanguageMode(.v6)]
        )
    ]
)
