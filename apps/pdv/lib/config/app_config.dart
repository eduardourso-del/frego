import 'package:flutter/foundation.dart';

/// Runtime config. Override with `--dart-define=API_URL=...`.
///
/// - **Debug:** defaults to localhost (emulator/Mac). On a **physical** Android
///   device, pass production or your LAN IP, e.g.
///   `--dart-define=API_URL=https://voltei-api-5z2jvudlna-rj.a.run.app`
///   — `127.0.0.1` on the phone is the phone itself, not your machine.
/// - **Release / Profile:** Cloud Run production URL.
class AppConfig {
  static const productionApiUrl = 'https://voltei-api-5z2jvudlna-rj.a.run.app';

  static const _debugDefaultApiUrl = 'http://127.0.0.1:8080';

  static const _apiUrlOverride = String.fromEnvironment('API_URL');

  static String get apiBaseUrl {
    final url = _apiUrlOverride.isNotEmpty
        ? _apiUrlOverride
        : (kDebugMode ? _debugDefaultApiUrl : productionApiUrl);

    if (!kDebugMode && _isNonProductionHost(url)) {
      throw StateError(
        'Release/Profile builds must use the production API '
        '($productionApiUrl), got: $url.',
      );
    }
    return url;
  }

  static void assertShipBuildUsesProductionApi() {
    final _ = apiBaseUrl;
  }

  /// Debug builds against localhost / emulator / LAN. The local API may
  /// accept requests without a Firebase bearer (`AUTH_BYPASS=true`).
  static bool get isLocalDebugApi =>
      kDebugMode && _isNonProductionHost(apiBaseUrl);

  static bool _isNonProductionHost(String url) {
    final host = Uri.tryParse(url)?.host.toLowerCase() ?? '';
    if (host.isEmpty) return true;
    if (host == 'localhost' || host == '127.0.0.1' || host == '::1') {
      return true;
    }
    if (host == '10.0.2.2') return true;
    if (host.startsWith('10.') ||
        host.startsWith('192.168.') ||
        host.startsWith('172.')) {
      return true;
    }
    return false;
  }
}
