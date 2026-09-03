plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.compose.compiler)
}

android {
    namespace = "app.bdstarter"
    compileSdk = 35

    defaultConfig {
        applicationId = "app.bdstarter"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"

        // Configuration reaches the app through BuildConfig, populated from
        // `local.properties` — there is no .env in an APK, and a value baked
        // into the binary is exactly what an app credential is.
        //
        // ⚠️ PUBLISHABLE TOKEN ONLY. `strings` on an APK finds anything here.
        val properties = java.util.Properties().apply {
            val file = rootProject.file("local.properties")
            if (file.exists()) file.inputStream().use { load(it) }
        }

        buildConfigField("String", "BD_HOST", "\"${properties.getProperty("bd.host") ?: "https://www.biab.app"}\"")
        buildConfigField("String", "BD_SITE_ID", "\"${properties.getProperty("bd.siteId") ?: ""}\"")
        buildConfigField("String", "BD_PK", "\"${properties.getProperty("bd.publishableKey") ?: ""}\"")
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation(project(":bd"))

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
}
