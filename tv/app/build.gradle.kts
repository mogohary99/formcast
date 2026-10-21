plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "dev.gohary.formcast"
    compileSdk = 36
    buildToolsVersion = "35.0.0"

    defaultConfig {
        applicationId = "dev.gohary.formcast"
        minSdk = 28 // Fire OS 7+ (Fire TV Stick 4K and later); Fire OS 8 = Android 11
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        buildConfigField("String", "RELAY_URL", "\"${project.findProperty("RELAY_URL") ?: "ws://10.0.2.2:8787"}\"")
        buildConfigField("String", "CAM_URL", "\"${project.findProperty("CAM_URL") ?: "http://10.0.2.2:8787/cam/"}\"")
    }
    buildTypes {
        release { isMinifyEnabled = false }
    }
    buildFeatures { compose = true; buildConfig = true }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2025.12.01")
    implementation(composeBom)
    implementation("androidx.activity:activity-compose:1.11.0")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.tv:tv-material:1.1.0")
    implementation("androidx.tv:tv-foundation:1.0.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.9.4")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.4")
    implementation("androidx.datastore:datastore-preferences:1.2.1")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("com.google.zxing:core:3.5.4")
    debugImplementation("androidx.compose.ui:ui-tooling")
    testImplementation("junit:junit:4.13.2")
}
