import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
val hasReleaseKeystore = keystorePropertiesFile.exists()
if (hasReleaseKeystore) {
    keystorePropertiesFile.inputStream().use { keystoreProperties.load(it) }
}

// Hardware SDK from Portal do Desenvolvedor → Downloads. Not redistributed.
val posDigitalSdk: List<java.io.File> =
    file("libs")
        .takeIf { it.isDirectory }
        ?.listFiles()
        ?.filter { it.isFile && it.extension.equals("aar", ignoreCase = true) }
        ?.sortedBy { it.name }
        ?: emptyList()

android {
    namespace = "com.bearlabs.frego_pdv"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    sourceSets {
        getByName("main") {
            kotlin.srcDir(
                if (posDigitalSdk.isNotEmpty()) "src/getnet/kotlin" else "src/getnetStub/kotlin",
            )
        }
    }

    defaultConfig {
        applicationId = "com.bearlabs.frego.pdv"
        // Get Smart starts at Android 7.1 (API 25): Sunmi P2. Newer terminals are 10–15.
        minSdk = 25
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        // P2 is armeabi-v7a. P3, DX8000, P30, S90 and O400 are arm64.
        ndk {
            abiFilters += listOf("armeabi-v7a", "arm64-v8a")
        }
    }

    // Sunmi P2 (Android 7.1) rejects an APK signed only with scheme v2.
    // AGP drops v1 when minSdk is 24 or higher unless this is set.
    signingConfigs {
        getByName("debug") {
            enableV1Signing = true
            enableV2Signing = true
        }
        if (hasReleaseKeystore) {
            create("release") {
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
                storeFile = file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                enableV1Signing = true
                enableV2Signing = true
            }
        }
    }

    buildTypes {
        release {
            // Play rejects the debug certificate. Getnet re-signs this same upload key.
            signingConfig =
                if (hasReleaseKeystore) {
                    signingConfigs.getByName("release")
                } else {
                    signingConfigs.getByName("debug")
                }
        }
    }

    // DX8000 and P3 fail to map uncompressed libflutter.so and stay on the splash.
    packaging {
        jniLibs {
            useLegacyPackaging = true
        }
    }
}

// reCAPTCHA (pulled by the Firebase Auth SDK) embeds android.webkit.WebView.
// Getnet rejects the APK when Jadx finds it. The PDV signs in over REST instead.
configurations.configureEach {
    exclude(group = "com.google.android.recaptcha", module = "recaptcha")
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

dependencies {
    posDigitalSdk.forEach { implementation(files(it)) }
}

flutter {
    source = "../.."
}

val requireGetnetSdk =
    tasks.register("requireGetnetSdk") {
        doLast {
            if (posDigitalSdk.isEmpty()) {
                throw GradleException(
                    "Get Store release needs the Getnet hardware SDK. Download " +
                        "libposdigital-*-release.aar from Portal do Desenvolvedor → Downloads " +
                        "→ SDK de Hardware and place it in apps/pdv/android/app/libs/.",
                )
            }
        }
    }

val requireUploadKeystore =
    tasks.register("requireUploadKeystore") {
        doLast {
            if (!hasReleaseKeystore) {
                throw GradleException(
                    "Play and Get Store releases need android/key.properties and an upload keystore.",
                )
            }
        }
    }

afterEvaluate {
    // Phone and Play releases run without the hardware SDK. Get Store opts in
    // with GETNET_STORE=true flutter build apk --release.
    tasks.findByName("assembleRelease")?.dependsOn(requireUploadKeystore)
    if (System.getenv("GETNET_STORE") == "true") {
        tasks.findByName("assembleRelease")?.dependsOn(requireGetnetSdk)
    }
    tasks.findByName("bundleRelease")?.dependsOn(requireUploadKeystore)
}
