plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.compose.compiler)
}

// The drop-in Compose renderer for BD forms: `BdForm(form = "contact", …)`.
//
// All the behaviour — conditions, calculations, validation, uploads,
// submission — lives in :bd's `BdFormController`, which is plain Kotlin and
// tested on the JVM. This module only draws it, with Material 3 controls that
// take the app's own theme (including dynamic color).
android {
    namespace = "app.bd.forms.ui"
    compileSdk = 35

    defaultConfig {
        minSdk = 26
    }

    buildFeatures {
        compose = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    jvmToolchain(17)
    // A library: every public symbol is API someone may depend on.
    explicitApi()
}

dependencies {
    api(project(":bd"))

    api(platform(libs.compose.bom))
    api(libs.compose.material3)
    implementation(libs.compose.ui)
    implementation(libs.compose.foundation)
    implementation(libs.compose.material.icons.core)
    // BackHandler, the document and photo pickers.
    implementation(libs.androidx.activity.compose)
    // Keeps a drop-in form's answers across rotation.
    implementation(libs.androidx.lifecycle.viewmodel.compose)

    testImplementation(kotlin("test-junit"))
}
