import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../firebase_options.dart';
import '../terminal/terminal_info.dart';

/// Cashier signed in with e-mail and password. The id token is a Firebase ID
/// token from the Identity Toolkit REST API, which the API already verifies.
class StaffAccount {
  const StaffAccount({required this.uid, required this.email});

  final String uid;
  final String email;
}

class StaffAuthException implements Exception {
  const StaffAuthException(this.code, [this.message]);

  final String code;
  final String? message;

  @override
  String toString() => message ?? code;
}

/// E-mail/password session without the Firebase Auth Android SDK.
///
/// That SDK depends on reCAPTCHA, and reCAPTCHA contains `android.webkit.WebView`.
/// Getnet rejects the APK when Jadx finds WebView. The terminals also have no
/// Google Play services, which that SDK waits on during startup.
class StaffAuth extends ChangeNotifier {
  StaffAuth._();

  static final instance = StaffAuth._();

  static const _idTokenKey = 'frego.staffAuth.idToken';
  static const _refreshKey = 'frego.staffAuth.refreshToken';
  static const _uidKey = 'frego.staffAuth.uid';
  static const _emailKey = 'frego.staffAuth.email';
  static const _expKey = 'frego.staffAuth.expiresAt';

  bool ready = false;
  StaffAccount? _account;
  String? _idToken;
  String? _refreshToken;
  DateTime? _expiresAt;
  var _restoreStarted = false;
  Future<String?>? _refreshing;

  StaffAccount? get currentUser => _account;

  Future<void> restore() async {
    if (_restoreStarted) return;
    _restoreStarted = true;
    try {
      final prefs = await SharedPreferences.getInstance();
      final refresh = prefs.getString(_refreshKey);
      final uid = prefs.getString(_uidKey);
      final token = prefs.getString(_idTokenKey);
      if (refresh == null ||
          refresh.isEmpty ||
          uid == null ||
          uid.isEmpty ||
          token == null ||
          token.isEmpty) {
        return;
      }
      _account = StaffAccount(
        uid: uid,
        email: prefs.getString(_emailKey) ?? '',
      );
      _idToken = token;
      _refreshToken = refresh;
      final expMillis = prefs.getInt(_expKey);
      _expiresAt = expMillis == null
          ? null
          : DateTime.fromMillisecondsSinceEpoch(expMillis);
      if (_needsRefresh) {
        try {
          await _refresh();
        } on StaffAuthException catch (e) {
          if (e.code != 'network-request-failed') await _clear();
        }
      }
    } catch (e, stack) {
      debugPrint('PDV: sessão local ilegível ($e)\n$stack');
      try {
        await _clear();
      } catch (_) {}
    } finally {
      ready = true;
      notifyListeners();
    }
  }

  Future<void> signIn({required String email, required String password}) async {
    final trimmed = email.trim();
    final data = await _postJson(
      Uri.parse(
        'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword'
        '?key=${FirebaseProject.apiKey}',
      ),
      {'email': trimmed, 'password': password, 'returnSecureToken': true},
    );
    final idToken = data['idToken'] as String?;
    final refresh = data['refreshToken'] as String?;
    final uid = data['localId'] as String?;
    if (idToken == null ||
        idToken.isEmpty ||
        refresh == null ||
        refresh.isEmpty ||
        uid == null ||
        uid.isEmpty) {
      throw const StaffAuthException('unknown', 'Resposta de login incompleta');
    }
    _account = StaffAccount(
      uid: uid,
      email: (data['email'] as String?) ?? trimmed,
    );
    _idToken = idToken;
    _refreshToken = refresh;
    _expiresAt = DateTime.now().add(
      Duration(seconds: int.tryParse('${data['expiresIn']}') ?? 3600),
    );
    await _persist();
    notifyListeners();
  }

  Future<void> signOut() async {
    await _clear();
    notifyListeners();
  }

  /// Firebase ID token for the API. Refreshes when it is about to expire.
  Future<String?> idToken() {
    final refresh = _refreshToken;
    final token = _idToken;
    if (refresh == null || refresh.isEmpty) return Future.value(null);
    if (token != null && token.isNotEmpty && !_needsRefresh) {
      return Future.value(token);
    }
    final inFlight = _refreshing;
    if (inFlight != null) return inFlight;
    final future = _refresh();
    _refreshing = future.whenComplete(() => _refreshing = null);
    return future;
  }

  bool get _needsRefresh {
    final expires = _expiresAt;
    if (expires == null) return true;
    return !expires.isAfter(DateTime.now().add(const Duration(seconds: 60)));
  }

  Future<String?> _refresh() async {
    final refresh = _refreshToken;
    if (refresh == null || refresh.isEmpty) return null;
    final data = await _postForm(
      Uri.parse(
        'https://securetoken.googleapis.com/v1/token?key=${FirebaseProject.apiKey}',
      ),
      'grant_type=refresh_token&refresh_token=${Uri.encodeQueryComponent(refresh)}',
    );
    final idToken = (data['id_token'] ?? data['access_token']) as String?;
    final nextRefresh = data['refresh_token'] as String?;
    if (idToken == null || idToken.isEmpty) {
      throw const StaffAuthException(
        'unknown',
        'Resposta de sessão incompleta',
      );
    }
    _idToken = idToken;
    if (nextRefresh != null && nextRefresh.isNotEmpty) {
      _refreshToken = nextRefresh;
    }
    final uid = data['user_id'] as String?;
    if (uid != null && uid.isNotEmpty) {
      _account = StaffAccount(uid: uid, email: _account?.email ?? '');
    }
    _expiresAt = DateTime.now().add(
      Duration(seconds: int.tryParse('${data['expires_in']}') ?? 3600),
    );
    await _persist();
    return _idToken;
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    final account = _account;
    final token = _idToken;
    final refresh = _refreshToken;
    final expires = _expiresAt;
    if (account == null ||
        token == null ||
        refresh == null ||
        expires == null) {
      await _clear();
      return;
    }
    await prefs.setString(_uidKey, account.uid);
    await prefs.setString(_emailKey, account.email);
    await prefs.setString(_idTokenKey, token);
    await prefs.setString(_refreshKey, refresh);
    await prefs.setInt(_expKey, expires.millisecondsSinceEpoch);
  }

  Future<void> _clear() async {
    _account = null;
    _idToken = null;
    _refreshToken = null;
    _expiresAt = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_uidKey);
    await prefs.remove(_emailKey);
    await prefs.remove(_idTokenKey);
    await prefs.remove(_refreshKey);
    await prefs.remove(_expKey);
  }

  Future<Map<String, dynamic>> _postJson(
    Uri uri,
    Map<String, dynamic> body,
  ) async {
    final response = await _send(
      () => http.post(
        uri,
        headers: {'Content-Type': 'application/json', ..._restrictionHeaders()},
        body: jsonEncode(body),
      ),
    );
    return _decode(response);
  }

  Future<Map<String, dynamic>> _postForm(Uri uri, String body) async {
    final response = await _send(
      () => http.post(
        uri,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ..._restrictionHeaders(),
        },
        body: body,
      ),
    );
    return _decode(response);
  }

  Map<String, String> _restrictionHeaders() {
    final hints = _hints;
    if (hints == null) return const <String, String>{};
    return hints;
  }

  Map<String, String>? _hints;
  Future<void>? _hintsLoad;

  Future<T> _send<T>(Future<T> Function() request) async {
    await _loadHints();
    try {
      return await request().timeout(const Duration(seconds: 20));
    } on TimeoutException {
      throw const StaffAuthException('network-request-failed');
    } on SocketException {
      throw const StaffAuthException('network-request-failed');
    } on http.ClientException {
      throw const StaffAuthException('network-request-failed');
    } on HandshakeException {
      throw const StaffAuthException('network-request-failed');
    }
  }

  Future<void> _loadHints() {
    final pending = _hintsLoad;
    if (pending != null) return pending;
    final future = () async {
      if (kIsWeb) return;
      if (Platform.isIOS) {
        _hints = const {'X-Ios-Bundle-Identifier': FirebaseProject.iosBundleId};
        return;
      }
      if (!Platform.isAndroid) return;
      final identity = await TerminalInfo.clientIdentity();
      _hints = {
        'X-Android-Package':
            identity?.packageName ?? FirebaseProject.androidPackage,
        if (identity != null && identity.certSha1.isNotEmpty)
          'X-Android-Cert': identity.certSha1,
      };
    }();
    _hintsLoad = future;
    return future;
  }

  Map<String, dynamic> _decode(http.Response response) {
    Object? decoded;
    try {
      decoded = jsonDecode(response.body);
    } catch (_) {
      throw const StaffAuthException('unknown', 'Resposta inválida do login');
    }
    if (response.statusCode == 200 && decoded is Map) {
      return Map<String, dynamic>.from(decoded);
    }
    throw StaffAuthException(
      identityToolkitErrorCode(decoded),
      decoded is Map && decoded['error'] is Map
          ? (decoded['error'] as Map)['message']?.toString()
          : null,
    );
  }
}

/// Maps an Identity Toolkit error body to the codes the login screen knows.
String identityToolkitErrorCode(Object? body) {
  if (body is! Map) return 'unknown';
  final error = body['error'];
  final message = error is Map ? error['message']?.toString() ?? '' : '';
  final token = message
      .split(RegExp(r'[\s:]'))
      .firstWhere((part) => part.isNotEmpty, orElse: () => '');
  switch (token) {
    case 'INVALID_LOGIN_CREDENTIALS':
    case 'EMAIL_NOT_FOUND':
    case 'INVALID_PASSWORD':
    case 'INVALID_EMAIL':
    case 'USER_DISABLED':
      return 'invalid-credential';
    case 'TOO_MANY_ATTEMPTS_TRY_LATER':
      return 'too-many-requests';
    default:
      return token.isEmpty ? 'unknown' : token;
  }
}
