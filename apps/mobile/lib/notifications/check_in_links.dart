import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/foundation.dart';

/// `frego://c/TOKEN` from the table QR. The token waits until the Cliente is in.
abstract final class CheckInLinks {
  static final ValueNotifier<String?> pending = ValueNotifier<String?>(null);
  static final AppLinks _links = AppLinks();
  static StreamSubscription<Uri>? _sub;
  static bool _attached = false;
  static String? _lastTaken;
  static DateTime? _lastTakenAt;

  static Future<void> attach() async {
    if (_attached || kIsWeb) return;
    _attached = true;
    try {
      _offer(await _links.getInitialLink());
    } catch (_) {}
    _sub ??= _links.uriLinkStream.listen(_offer, onError: (_) {});
  }

  static void _offer(Uri? uri) {
    final token = tokenFrom(uri);
    if (token == null || token == pending.value) return;
    if (token == _lastTaken &&
        _lastTakenAt != null &&
        DateTime.now().difference(_lastTakenAt!) < const Duration(seconds: 4)) {
      return;
    }
    pending.value = token;
  }

  static String? take() {
    final token = pending.value;
    if (token == null) return null;
    pending.value = null;
    _lastTaken = token;
    _lastTakenAt = DateTime.now();
    return token;
  }

  static String? tokenFrom(Uri? uri) {
    if (uri == null || uri.scheme != 'frego' || uri.host != 'c') return null;
    if (uri.pathSegments.length != 1) return null;
    return _token(uri.pathSegments.first);
  }

  /// The printed QR is an https link. The app door is frego://c/TOKEN.
  static String? tokenFromScan(String raw) {
    final text = raw.trim();
    if (text.isEmpty) return null;
    final uri = Uri.tryParse(text);
    if (uri == null) return null;
    final fromApp = tokenFrom(uri);
    if (fromApp != null) return fromApp;
    if (uri.scheme != 'https' && uri.scheme != 'http') return null;
    final segments = uri.pathSegments.where((part) => part.isNotEmpty).toList();
    if (segments.length != 2 || segments.first != 'c') return null;
    return _token(segments.last);
  }

  static String? _token(String value) {
    if (value.length < 8 || value.length > 80) return null;
    return value;
  }
}
