import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/api_error.dart';
import '../api/pdv_api.dart';
import '../config/app_config.dart';
import 'staff_auth.dart';

class StaffSession extends ChangeNotifier {
  StaffSession({required this.user});

  final StaffAccount user;

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
    try {
      final token = await StaffAuth.instance.idToken();
      if (token != null && token.isNotEmpty) return token;
    } on StaffAuthException catch (e) {
      if (AppConfig.isLocalDebugApi) {
        debugPrint(
          'PDV local: token Firebase indisponível (${e.code}). AUTH_BYPASS.',
        );
        return null;
      }
      // A blip while the hourly token refreshes is not a sign-out.
      if (e.code == 'network-request-failed') {
        throw ApiException(
          code: 'NETWORK',
          message: 'Sem conexão para renovar a sessão. Tente de novo.',
        );
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
      await _applyList(await api.listBusinesses(), preferredId: stored);
    } catch (e) {
      error = humanizeError(e);
      businesses = [];
      businessId = null;
      picking = false;
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  /// Reloads the Equipe list without leaving the till. A shop added after
  /// sign-in shows up, and a Desativado shop drops off.
  Future<void> refreshBusinesses() async {
    if (loading) return;
    try {
      await _applyList(await api.listBusinesses());
    } catch (_) {
      // Keep the shops already on screen.
    }
    notifyListeners();
  }

  Future<void> _applyList(
    List<StaffBusiness> list, {
    String? preferredId,
  }) async {
    final wasPicking = picking;
    businesses = list;
    if (list.isEmpty) {
      businessId = null;
      picking = false;
      error = 'Este e-mail não está em nenhum estabelecimento.';
      return;
    }
    error = null;
    final preferred = preferredId ?? businessId;
    final match = list.where((b) => b.id == preferred).toList(growable: false);
    if (match.isNotEmpty) {
      businessId = match.first.id;
      picking = wasPicking && list.length > 1;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_storageKey(), businessId!);
      return;
    }
    if (list.length == 1) {
      await setBusinessId(list.first.id);
      return;
    }
    businessId = null;
    picking = true;
  }

  Future<void> setBusinessId(String id) async {
    businessId = id;
    picking = false;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_storageKey(), id);
    notifyListeners();
  }

  /// Opens the switcher when this conta is on more than one Estabelecimento.
  /// Returns false when there is still only one.
  Future<bool> showPicker() async {
    try {
      await _applyList(await api.listBusinesses());
    } catch (_) {
      // Open with the list already loaded.
    }
    final opened = businesses.length > 1;
    if (opened) picking = true;
    notifyListeners();
    return opened;
  }

  void cancelPicker() {
    if (business == null) return;
    picking = false;
    notifyListeners();
  }

  Future<void> signOut() async {
    await StaffAuth.instance.signOut();
  }
}
