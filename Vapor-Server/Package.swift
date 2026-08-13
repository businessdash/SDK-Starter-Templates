// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "BiabVaporStarter",
    platforms: [.macOS(.v14)],
    dependencies: [
        .package(url: "https://github.com/vapor/vapor.git", from: "4.106.0"),
        .package(url: "https://github.com/vapor/leaf.git", from: "4.4.0")
    ],
    targets: [
        .executableTarget(
            name: "App",
            dependencies: [
                .product(name: "Vapor", package: "vapor"),
                .product(name: "Leaf", package: "leaf")
            ],
            swiftSettings: [.swiftLanguageMode(.v6)]
        )
    ]
)
