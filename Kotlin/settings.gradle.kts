pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

// Downloads the JDK the modules' `jvmToolchain(17)` asks for when the machine
// doesn't have one, instead of failing with "Cannot find a Java installation".
plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "bd-starter"

// Three modules, deliberately:
//
//   :bd       — the client. PURE KOTLIN/JVM: no Android dependency, so it
//               builds and tests without the Android SDK, and stays reusable
//               in a server or a Kotlin Multiplatform target later. The forms
//               engine (rules, formulas, controller) lives here too.
//   :bd-forms — the drop-in Compose renderer for BD forms (Android library).
//   :bd-sign-in — native customer sign-in in the business's brand (Android library).
//   :app      — the Android app (Compose) built on them.
//
// The split means the part most likely to be wrong — decoding, error mapping,
// the access gate — is testable with `./gradlew :bd:test` alone.
include(":bd")
include(":bd-forms")
include(":bd-sign-in")
include(":app")
