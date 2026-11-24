import java.util.Properties

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
        // `Properties`, imported: inside `android {}` a bare `java.` resolves
        // to the Java extension, not the package, and the script won't compile.
        val properties = Properties().apply {
            val file = rootProject.file("local.properties")
            if (file.exists()) file.inputStream().use { load(it) }
        }

        // The apex host: www redirects to it, and a redirect to another host
        // drops the Authorization header, so every keyed call would fail.
        buildConfigField("String", "BD_HOST", "\"${properties.getProperty("bd.host") ?: "https://businessdash.us"}\"")
        buildConfigField("String", "BD_SITE_ID", "\"${properties.getProperty("bd.siteId") ?: ""}\"")
        buildConfigField("String", "BD_PK", "\"${properties.getProperty("bd.publishableKey") ?: ""}\"")
        // A Live form's slug for the Form tab. Empty: a bundled sample form.
        buildConfigField("String", "BD_FORM", "\"${properties.getProperty("bd.form") ?: ""}\"")
        // A practice quiz's slug for the Quiz tab. Empty: a bundled sample quiz.
        buildConfigField("String", "BD_QUIZ", "\"${properties.getProperty("bd.quiz") ?: ""}\"")
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
    implementation(project(":bd-forms"))
    implementation(project(":bd-sign-in"))

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    implementation(libs.compose.material.icons.core)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
}
