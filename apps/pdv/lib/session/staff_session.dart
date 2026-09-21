import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/api_error.dart';
import '../api/pdv_api.dart';
import '../config/app_config.dart';

class StaffSession extends ChangeNotifier {
  StaffSession({required this.user});

  final User user;

  List<StaffBusiness> businesses = [];
  String? businessId;
  bool loading = true;
  String? error;
  bool picking = false;

  late final PdvApi api = PdvApi(authHeaders);

  StaffBusiness? get business {
    final id = businessId;
    if (id == null) return null;
    for (final b in businesses) {
      if (b.id == id) return b;
    }
    return null;
  }

  String _storageKey() => 'frego.activeBusinessId.${user.uid}';

  Future<Map<String, String>> authHeaders() async {
    final token = await _idToken();
    return {
      if (token != null) 'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
      'X-Business-Id': ?businessId,
    };
  }

  /// Local API (`AUTH_BYPASS`) can run without a bearer. Production cannot.
  Future<String?> _idToken() async {
    final current = FirebaseAuth.instance.currentUser ?? user;
    try {
      final token = await current.getIdToken();
      if (token != null && token.isNotEmpty) return token;
    } on FirebaseAuthException catch (e) {
      if (AppConfig.isLocalDebugApi) {
        debugPrint(
          'PDV local: token Firebase indisponível (${e.code}). AUTH_BYPASS.',
        );
        return null;
      }
      throw ApiException(
        code: 'AUTH',
        message: 'Falha ao autenticar (${e.code}). ${e.message ?? ''}'.trim(),
      );
    }
    if (AppConfig.isLocalDebugApi) return null;
    throw ApiException(
      code: 'AUTH',
      message: 'Sessão expirada. Entre de novo.',
    );
  }

  Future<void> load() async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      final stored = prefs.getString(_storageKey());
      businesses = await api.listBusinesses();
      if (businesses.isEmpty) {
        businessId = null;
        picking = false;
        error = 'Este e-mail não está em nenhuma loja Frego';
        return;
      }
      final preferred = businesses
          .where((b) => b.id == stored)
          .toList(growable: false);
      if (preferred.isNotEmpty) {
        businessId = preferred.first.id;
        picking = false;
      } else if (businesses.length == 1) {
        await setBusinessId(businesses.first.id);
        picking = false;
      } else {
        businessId = null;
        picking = true;
      }
    } catch (e) {
      error = humanizeError(e);
      businesses = [];
      businessId = null;
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> setBusinessId(String id) async {
    businessId = id;
    picking = false;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_storageKey(), id);
    notifyListeners();
  }

  void showPicker() {
    picking = true;
    notifyListeners();
  }

  Future<void> signOut() async {
    await FirebaseAuth.instance.signOut();
  }
}
