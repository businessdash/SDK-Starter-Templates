plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
    `maven-publish`
    signing
}

// Coordinates: us.businessdash:sdk
//
// The group is a reverse of a domain we control, which Maven Central requires
// and verifies. `sdk` rather than `biab` because the package rename already
// happened everywhere else — see BusinessDashKit on the Swift side.
group = "us.businessdash"
version = "0.9.80"

kotlin {
    jvmToolchain(17)

    compilerOptions {
        // Public API is a contract for consumers now, not just the app module.
        // Strict mode makes an accidentally-public symbol a build failure
        // rather than something we are stuck supporting.
        freeCompilerArgs.add("-Xexplicit-api=strict")
    }
}

java {
    // Maven Central REQUIRES both. A release missing either is rejected at
    // validation, after the upload, which is a slow way to find out.
    withSourcesJar()
    withJavadocJar()
}

dependencies {
    api(libs.ktor.client.core)
    api(libs.kotlinx.coroutines.core)
    implementation(libs.ktor.client.okhttp)
    implementation(libs.ktor.client.content.negotiation)
    implementation(libs.ktor.serialization.json)

    testImplementation(kotlin("test"))
    testImplementation(libs.ktor.client.mock)
    testImplementation(libs.kotlinx.coroutines.test)
}

tasks.test {
    useJUnitPlatform()
}

publishing {
    publications {
        create<MavenPublication>("maven") {
            from(components["java"])
            artifactId = "sdk"

            // Every field below is MANDATORY for Maven Central. Omitting any
            // one of them fails validation after upload rather than before.
            pom {
                name.set("BusinessDash SDK")
                description.set(
                    "Official Kotlin/JVM client for the BusinessDash Package API — " +
                        "storefront, cart, checkout, blog, forms, chatbot, customer " +
                        "portal and scheduling."
                )
                url.set("https://businessdash.us")

                licenses {
                    license {
                        name.set("MIT License")
                        url.set("https://opensource.org/licenses/MIT")
                    }
                }
                developers {
                    developer {
                        id.set("businessdash")
                        name.set("BusinessDash")
                        url.set("https://businessdash.us")
                    }
                }
                scm {
                    connection.set("scm:git:https://github.com/businessdash/platform.git")
                    developerConnection.set("scm:git:ssh://git@github.com/businessdash/platform.git")
                    url.set("https://github.com/businessdash/platform")
                }
            }
        }
    }

    repositories {
        maven {
            name = "centralPortal"
            // Snapshots and releases go to different endpoints; picking the
            // wrong one silently succeeds and publishes nothing findable.
            url = uri(
                if (version.toString().endsWith("SNAPSHOT")) {
                    "https://central.sonatype.com/repository/maven-snapshots/"
                } else {
                    "https://ossrh-staging-api.central.sonatype.com/service/local/staging/deploy/maven2/"
                }
            )
            credentials {
                // Never hardcoded. Set MAVEN_CENTRAL_USERNAME / _PASSWORD in the
                // environment, or the matching properties in ~/.gradle.
                username = System.getenv("MAVEN_CENTRAL_USERNAME")
                    ?: providers.gradleProperty("mavenCentralUsername").orNull
                password = System.getenv("MAVEN_CENTRAL_PASSWORD")
                    ?: providers.gradleProperty("mavenCentralPassword").orNull
            }
        }
    }
}

signing {
    // Maven Central requires a GPG signature on every artifact.
    //
    // Guarded so a local `./gradlew :biab:build` still works without a key —
    // signing is only needed to PUBLISH, and requiring a key to compile would
    // make the module hostile to anyone cloning the starter.
    val key = System.getenv("SIGNING_KEY") ?: providers.gradleProperty("signingKey").orNull
    val password = System.getenv("SIGNING_PASSWORD")
        ?: providers.gradleProperty("signingPassword").orNull
    if (key != null && password != null) {
        useInMemoryPgpKeys(key, password)
        sign(publishing.publications["maven"])
    }
}
