plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.compose.compiler)
}

// Native sign-in for a business's customers, in the business's brand:
// `BdSignIn(brand = BdSignInBrand("Acme", logo = …), backend = …)`.
//
// Email and password, codes by email, and Google through the app's own
// Credential Manager call. Talks to BD through the app's server
// (`BdServerSignInBackend`): a native app holds no key. Depends on nothing
// but Compose.
android {
    namespace = "app.bd.signin"
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
    api(platform(libs.compose.bom))
    api(libs.compose.material3)
    implementation(libs.compose.ui)
    implementation(libs.compose.foundation)
    // BackHandler.
    implementation(libs.androidx.activity.compose)
    implementation(libs.kotlinx.coroutines.core)
}
