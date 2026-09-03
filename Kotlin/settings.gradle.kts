pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "bd-starter"

// Two modules, deliberately:
//
//   :bd — the client. PURE KOTLIN/JVM: no Android dependency, so it builds
//           and tests without the Android SDK, and stays reusable in a server
//           or a Kotlin Multiplatform target later.
//   :app  — the Android app (Compose) built on it.
//
// The split means the part most likely to be wrong — decoding, error mapping,
// the access gate — is testable with `./gradlew :bd:test` alone.
include(":bd")
include(":app")
