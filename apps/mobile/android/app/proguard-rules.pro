# Firebase ComponentRegistrars are instantiated via reflection.
# Kotlin 2.x + R8 strips their no-arg constructors, which crashes
# Firebase.initializeApp with "FirebaseCrashlytics component is not present".
-keep class * implements com.google.firebase.components.ComponentRegistrar
-keepclassmembers class * implements com.google.firebase.components.ComponentRegistrar {
    public <init>();
}
-keep class com.google.firebase.components.** { *; }
