import 'dart:io' show Platform;

import 'package:cronet_http/cronet_http.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

http.Client? _apiClient;

/// Shared client for the customer API.
///
/// On Android, Flutter's client can sit on an address that never answers
/// until the sync screen hits its 20-second cap. Chrome's stack abandons
/// that address. The system resolver is used so a network that blocks
/// Google's own DNS still resolves the host.
http.Client get apiClient {
  final existing = _apiClient;
  if (existing != null) return existing;
  final created = _openApiClient();
  _apiClient = created;
  return created;
}

http.Client _openApiClient() {
  if (!kIsWeb && Platform.isAndroid) {
    final engine = CronetEngine.build(
      cacheMode: CacheMode.disabled,
      enableHttp2: true,
      enableQuic: true,
      useBuiltInDnsResolver: false,
      userAgent: 'Frego (Android)',
    );
    return CronetClient.fromCronetEngine(engine, closeEngine: true);
  }
  return http.Client();
}
