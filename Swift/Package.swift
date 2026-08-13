// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "BiabKit",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        // The data layer. No dependencies — the BIAB Package API is plain REST
        // with a bearer key, so URLSession + Codable covers all of it.
        .library(name: "BiabKit", targets: ["BiabKit"]),
        // SwiftUI screens built on BiabKit. A LIBRARY, not an app target:
        // SwiftPM can't build an iOS app bundle, so the starter app is an
        // Xcode project that imports this. It still compiles under
        // `swift build` on macOS, which is what keeps it honest.
        .library(name: "BiabStarterApp", targets: ["BiabStarterApp"])
    ],
    targets: [
        .target(
            name: "BiabKit",
            swiftSettings: [.swiftLanguageMode(.v6)]
        ),
        .target(
            name: "BiabStarterApp",
            dependencies: ["BiabKit"],
            swiftSettings: [.swiftLanguageMode(.v6)]
        ),
        .testTarget(
            name: "BiabKitTests",
            dependencies: ["BiabKit"],
            swiftSettings: [.swiftLanguageMode(.v6)]
        )
    ]
)
