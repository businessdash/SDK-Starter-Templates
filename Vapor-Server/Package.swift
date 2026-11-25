// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "BdVaporStarter",
    platforms: [.macOS(.v14)],
    dependencies: [
        .package(url: "https://github.com/vapor/vapor.git", from: "4.106.0"),
        .package(url: "https://github.com/vapor/leaf.git", from: "4.4.0"),
        // Reads the forms' multipart posts (Vapor uses it already).
        .package(url: "https://github.com/vapor/multipart-kit.git", from: "4.7.0")
    ],
    targets: [
        .executableTarget(
            name: "App",
            dependencies: [
                .product(name: "Vapor", package: "vapor"),
                .product(name: "Leaf", package: "leaf"),
                .product(name: "MultipartKit", package: "multipart-kit"),
                "BdForms"
            ],
            swiftSettings: [.swiftLanguageMode(.v6)]
        ),
        // BD's forms and quiz engine: the Swift starter's BdForms without its
        // SwiftUI views (conditions, steps, calculations, validation, uploads,
        // submission; quizzes, their timer and grading). A copy, kept in step
        // with the Swift starter by BD's `pnpm gen:native-forms`.
        .target(
            name: "BdForms",
            swiftSettings: [.swiftLanguageMode(.v6)]
        ),
        // `swift test`: the post sanitizer gives the TypeScript's answers.
        .testTarget(
            name: "AppTests",
            dependencies: [.target(name: "App")],
            // Read by path in the test, not bundled as a resource.
            exclude: ["Fixtures"],
            swiftSettings: [.swiftLanguageMode(.v6)]
        )
    ]
)
