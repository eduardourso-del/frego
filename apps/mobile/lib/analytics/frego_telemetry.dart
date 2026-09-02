import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

/// Analytics + Crashlytics facade. No-ops when Firebase is not ready
/// (widget tests) or on web (Crashlytics is mobile-only).
///
/// Never send phone, e-mail, or name — user id is the Firebase UID only.
abstract final class FregoTelemetry {
  static NavigatorObserver? observer;

  static bool get _ready => Firebase.apps.isNotEmpty;

  static bool get _crashlyticsReady => _ready && !kIsWeb;

  /// Call once after [Firebase.initializeApp].
  static Future<void> attach() async {
    if (!_ready) return;

    observer = FirebaseAnalyticsObserver(
      analytics: FirebaseAnalytics.instance,
      nameExtractor: _routeName,
    );

    if (!_crashlyticsReady) return;

    // DebugView still gets Analytics in debug; Crashlytics stays off so
    // local hot-restart noise does not land in production.
    await FirebaseCrashlytics.instance
        .setCrashlyticsCollectionEnabled(!kDebugMode);

    FlutterError.onError = (details) {
      FirebaseCrashlytics.instance.recordFlutterFatalError(details);
    };
    PlatformDispatcher.instance.onError = (error, stack) {
      FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
      return true;
    };
  }

  static String? _routeName(RouteSettings settings) {
    final name = settings.name;
    if (name == null || name.isEmpty) return null;
    if (name == Navigator.defaultRouteName) return 'auth_gate';
    return name.startsWith('/') ? name.substring(1) : name;
  }

  static Future<void> screen(String name) async {
    if (!_ready || name.isEmpty) return;
    await FirebaseAnalytics.instance.logScreenView(screenName: name);
  }

  /// [uid] is the Firebase Auth uid. Pass null on logout.
  static Future<void> setUser(String? uid) async {
    if (!_ready) return;
    await FirebaseAnalytics.instance.setUserId(id: uid);
    if (_crashlyticsReady) {
      await FirebaseCrashlytics.instance.setUserIdentifier(uid ?? '');
    }
  }
}
