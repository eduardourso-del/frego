import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/frego_api.dart';
import '../config/app_config.dart';

/// Destination after a push tap. [CustomerShell] consumes this.
class PushOpenTarget {
  const PushOpenTarget({
    required this.type,
    required this.businessId,
    this.campaignId,
    this.unitKind,
    this.transactionId,
    this.quantity,
  });

  /// `campaign_new` or `earn`.
  final String type;
  final String businessId;
  final String? campaignId;

  /// `stamps` | `points` | `cashback` for earn pushes.
  final String? unitKind;
  final String? transactionId;
  final int? quantity;

  bool sameDestination(PushOpenTarget other) {
    return type == other.type &&
        businessId == other.businessId &&
        campaignId == other.campaignId &&
        unitKind == other.unitKind &&
        transactionId == other.transactionId;
  }

  /// Reads FCM `data` or the native APNs userInfo flatten.
  static PushOpenTarget? tryParse(Map<dynamic, dynamic> raw) {
    final data = <String, String>{};
    void absorb(Map<dynamic, dynamic> map) {
      for (final entry in map.entries) {
        final key = entry.key?.toString();
        if (key == null || key.isEmpty) continue;
        final value = entry.value;
        if (value is String && value.isNotEmpty) {
          data[key] = value;
        } else if (value is Map) {
          absorb(Map<dynamic, dynamic>.from(value));
        } else if (value != null) {
          final asString = value.toString();
          if (asString.isNotEmpty) data[key] = asString;
        }
      }
    }

    absorb(raw);
    final businessId = data['businessId'] ?? data['business_id'];
    if (businessId == null || businessId.isEmpty) return null;
    final quantityRaw = data['quantity'];
    return PushOpenTarget(
      type: data['type'] ?? '',
      businessId: businessId,
      campaignId: data['campaignId'] ?? data['campaign_id'],
      unitKind: data['unitKind'] ?? data['unit_kind'],
      transactionId: data['transactionId'] ?? data['transaction_id'],
      quantity: quantityRaw == null ? null : int.tryParse(quantityRaw),
    );
  }
}

abstract final class PendingPushOpen {
  static final ValueNotifier<PushOpenTarget?> target =
      ValueNotifier<PushOpenTarget?>(null);
  static PushOpenTarget? _lastOffered;
  static DateTime? _lastOfferedAt;

  static void offer(PushOpenTarget next) {
    if (next.businessId.isEmpty) return;
    final now = DateTime.now();
    final last = _lastOffered;
    if (last != null &&
        last.sameDestination(next) &&
        _lastOfferedAt != null &&
        now.difference(_lastOfferedAt!) < const Duration(seconds: 4)) {
      return;
    }
    _lastOffered = next;
    _lastOfferedAt = now;
    target.value = next;
  }

  static PushOpenTarget? take() {
    final current = target.value;
    if (current == null) return null;
    target.value = null;
    return current;
  }
}

abstract final class PushService {
  static StreamSubscription<String>? _tokenSub;
  static StreamSubscription<RemoteMessage>? _openedSub;
  static StreamSubscription<RemoteMessage>? _foregroundSub;
  static StreamSubscription<User?>? _authSub;
  static bool _listenersReady = false;
  static bool _permissionGranted = false;
  static String? lastToken;

  static bool get _supported {
    if (kIsWeb) return false;
    return defaultTargetPlatform == TargetPlatform.iOS ||
        defaultTargetPlatform == TargetPlatform.android;
  }

  static const _native = MethodChannel('frego/push');
  static const _deferredPref = 'frego_push_prompt_deferred';
  static bool _nativeHandlerReady = false;

  static bool get isSupported => _supported;

  static bool _isGranted(AuthorizationStatus status) {
    return status == AuthorizationStatus.authorized ||
        status == AuthorizationStatus.provisional;
  }

  static Future<AuthorizationStatus> authorizationStatus() async {
    if (!_supported) return AuthorizationStatus.authorized;
    final settings =
        await FirebaseMessaging.instance.getNotificationSettings();
    return settings.authorizationStatus;
  }

  /// True when we should explain notifications before the OS alert.
  static Future<bool> shouldShowPrePrompt() async {
    if (!_supported) return false;
    final status = await authorizationStatus();
    if (status != AuthorizationStatus.notDetermined) return false;
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_deferredPref) != true;
  }

  static Future<void> deferPrePrompt() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_deferredPref, true);
  }

  /// Upload an existing FCM token if the user already allowed alerts.
  /// Never presents the system permission dialog.
  static Future<void> syncIfAuthorized() async {
    if (!_supported) return;
    final status = await authorizationStatus();
    _permissionGranted = _isGranted(status);
    if (!_permissionGranted) return;
    attachNative();
    try {
      await _native.invokeMethod<void>('register');
    } catch (e) {
      debugPrint('PushService native register: $e');
    }
    unawaited(_registerInBackground());
  }

  /// Shows the OS permission prompt and returns as soon as the user answers.
  /// Token registration continues in the background if they allowed alerts.
  static Future<void> start() async {
    if (!_supported) return;
    try {
      final messaging = FirebaseMessaging.instance;
      NotificationSettings settings;
      try {
        settings = await messaging
            .requestPermission(
              alert: true,
              badge: true,
              sound: true,
            )
            .timeout(const Duration(seconds: 20));
      } on TimeoutException {
        settings = await messaging.getNotificationSettings();
        debugPrint(
          'PushService.requestPermission timed out; status=${settings.authorizationStatus}',
        );
      }
      _permissionGranted = _isGranted(settings.authorizationStatus);
      debugPrint(
        'PushService permission=${settings.authorizationStatus} api=${AppConfig.apiBaseUrl}',
      );
      if (!_permissionGranted) {
        debugPrint(
          'PushService: notifications not allowed; skip token registration',
        );
        return;
      }
      attachNative();
      try {
        await _native.invokeMethod<void>('register');
      } catch (e) {
        debugPrint('PushService native register: $e');
      }
      unawaited(_registerInBackground());
    } catch (e) {
      debugPrint('PushService.start failed: $e');
    }
  }

  /// Listen for native APNs + notification taps as soon as Flutter is up.
  static void attachNative() {
    if (!_supported) return;
    if (_nativeHandlerReady) return;
    _nativeHandlerReady = true;
    _native.setMethodCallHandler((call) async {
      if (call.method == 'apns') {
        debugPrint('PushService native APNs token (${call.arguments} bytes)');
        unawaited(_syncToken());
      } else if (call.method == 'apnsError') {
        debugPrint('PushService native APNs error: ${call.arguments}');
      } else if (call.method == 'opened') {
        final args = call.arguments;
        debugPrint('PushService native opened $args');
        if (args is Map) {
          _offerFromMap(Map<dynamic, dynamic>.from(args));
        }
      }
    });
  }

  static Future<void> _registerInBackground() async {
    try {
      await _ensureListeners(FirebaseMessaging.instance);
      await _syncToken();
    } catch (e) {
      debugPrint('PushService.register failed: $e');
      _listenersReady = false;
    }
  }

  static Future<void> _ensureListeners(FirebaseMessaging messaging) async {
    if (_listenersReady) return;
    _listenersReady = true;
    await messaging.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );
    await messaging.setAutoInitEnabled(true);

    _tokenSub = messaging.onTokenRefresh.listen(_onFcmToken);
    _openedSub = FirebaseMessaging.onMessageOpenedApp.listen(_onOpened);
    _foregroundSub = FirebaseMessaging.onMessage.listen((message) {
      debugPrint(
        'PushService foreground message type=${message.data['type']} title=${message.notification?.title}',
      );
    });
    _authSub = FirebaseAuth.instance.authStateChanges().listen((user) {
      if (user == null || !_permissionGranted) return;
      final token = lastToken;
      if (token != null) unawaited(_upload(token));
    });

    try {
      final initial = await messaging.getInitialMessage().timeout(
        const Duration(seconds: 2),
      );
      if (initial != null) _onOpened(initial);
    } catch (e) {
      debugPrint('PushService.getInitialMessage: $e');
    }
  }

  static Future<void> _syncToken() async {
    if (!_permissionGranted) return;
    final token = await _resolveFcmToken(FirebaseMessaging.instance);
    if (token != null) await _onFcmToken(token);
  }

  static Future<String?> _resolveFcmToken(FirebaseMessaging messaging) async {
    if (defaultTargetPlatform == TargetPlatform.iOS) {
      for (var i = 0; i < 40; i++) {
        final apns = await messaging.getAPNSToken();
        if (apns != null) {
          debugPrint('PushService APNs ready after ${i * 500}ms');
          break;
        }
        if (i == 0 || i == 10 || i == 20 || i == 39) {
          debugPrint('PushService waiting for APNs ($i/40)');
        }
        await Future<void>.delayed(const Duration(milliseconds: 500));
      }
    }
    for (var attempt = 0; attempt < 5; attempt++) {
      try {
        final token = await messaging.getToken().timeout(
          const Duration(seconds: 8),
        );
        if (token != null) return token;
        debugPrint('PushService.getToken returned null (attempt $attempt)');
      } catch (e) {
        debugPrint('PushService.getToken attempt $attempt: $e');
      }
      await Future<void>.delayed(const Duration(seconds: 2));
    }
    return null;
  }

  static Future<void> stop() async {
    final token = lastToken;
    await _tokenSub?.cancel();
    await _openedSub?.cancel();
    await _foregroundSub?.cancel();
    await _authSub?.cancel();
    _tokenSub = null;
    _openedSub = null;
    _foregroundSub = null;
    _authSub = null;
    _listenersReady = false;
    _permissionGranted = false;
    lastToken = null;
    if (token == null) return;
    try {
      await deleteDeviceToken(token);
    } catch (e) {
      debugPrint('PushService.stop failed: $e');
    }
  }

  static Future<void> _onFcmToken(String token) async {
    if (!_permissionGranted) return;
    lastToken = token;
    if (FirebaseAuth.instance.currentUser == null) {
      debugPrint('PushService: got FCM token, waiting for login to upload');
      return;
    }
    await _upload(token);
  }

  static Future<void> _upload(String token) async {
    if (!_permissionGranted) return;
    lastToken = token;
    final platform =
        defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android';
    try {
      await putDeviceToken(token: token, platform: platform);
      debugPrint('PushService: uploaded $platform token');
    } catch (e) {
      debugPrint('PushService.upload failed: $e');
    }
  }

  static void _onOpened(RemoteMessage message) {
    debugPrint('PushService opened fcm data=${message.data}');
    _offerFromMap(message.data);
  }

  static void _offerFromMap(Map<dynamic, dynamic> raw) {
    final target = PushOpenTarget.tryParse(raw);
    if (target == null) {
      debugPrint('PushService opened ignored (no businessId) keys=${raw.keys.toList()}');
      return;
    }
    debugPrint(
      'PushService open → ${target.type} business=${target.businessId} '
      'campaign=${target.campaignId} kind=${target.unitKind}',
    );
    PendingPushOpen.offer(target);
  }
}
