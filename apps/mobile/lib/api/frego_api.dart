import 'dart:async';
import 'dart:convert';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;

import '../config/app_config.dart';

String get apiBaseUrl => AppConfig.apiBaseUrl;

Future<Map<String, String>> customerAuthHeaders() async {
  final user = FirebaseAuth.instance.currentUser;
  if (user == null) {
    throw Exception('Faça login com o telefone');
  }
  final token = await user.getIdToken(true).timeout(
        const Duration(seconds: 15),
        onTimeout: () => throw Exception('Não foi possível autenticar'),
      );
  if (token == null || token.isEmpty) {
    throw Exception('Faça login com o telefone');
  }
  return {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  };
}

Map<String, dynamic> _decode(http.Response res) {
  final body = jsonDecode(res.body) as Map<String, dynamic>;
  if (res.statusCode >= 400) {
    throw Exception(body['error'] as String? ?? 'Erro na API');
  }
  return body;
}

/// Após o OTP: cria/vincula Customer pelo telefone e mescla carimbos do balcão.
Future<Map<String, dynamic>> fetchMyCustomer() async {
  final headers = await customerAuthHeaders();
  final res = await http.get(
    Uri.parse('$apiBaseUrl/me/customer'),
    headers: headers,
  );
  return _decode(res);
}

Future<Map<String, dynamic>> updateMyCustomer({
  String? displayName,
  String? birthday,
  bool clearBirthday = false,
  bool onboardingCompleted = true,
  bool? notificationsEnabled,
}) async {
  final headers = await customerAuthHeaders();
  final res = await http.patch(
    Uri.parse('$apiBaseUrl/me/customer'),
    headers: headers,
    body: jsonEncode({
      if (displayName != null) 'displayName': displayName,
      'onboardingCompleted': onboardingCompleted,
      if (clearBirthday) 'birthday': null,
      if (!clearBirthday && birthday != null) 'birthday': birthday,
      if (notificationsEnabled != null)
        'notificationsEnabled': notificationsEnabled,
    }),
  );
  return _decode(res);
}

Future<Map<String, dynamic>> fetchMyMemberships() async {
  final headers = await customerAuthHeaders();
  final res = await http.get(
    Uri.parse('$apiBaseUrl/me/memberships'),
    headers: headers,
  );
  return _decode(res);
}

Future<Map<String, dynamic>> fetchMyWallet({String? businessId}) async {
  final headers = await customerAuthHeaders();
  final uri = businessId == null
      ? Uri.parse('$apiBaseUrl/me/wallet')
      : Uri.parse('$apiBaseUrl/me/wallet').replace(
          queryParameters: {'businessId': businessId},
        );
  final res = await http.get(uri, headers: headers);
  return _decode(res);
}

Future<Map<String, dynamic>> redeemCampaign({
  required String businessId,
  required String campaignId,
}) async {
  final headers = await customerAuthHeaders();
  final res = await http.post(
    Uri.parse('$apiBaseUrl/me/redeem'),
    headers: headers,
    body: jsonEncode({
      'businessId': businessId,
      'campaignId': campaignId,
    }),
  );
  return _decode(res);
}

Future<Map<String, dynamic>> fetchMyHistory({int limit = 50}) async {
  final headers = await customerAuthHeaders();
  final res = await http.get(
    Uri.parse('$apiBaseUrl/me/history').replace(
      queryParameters: {'limit': '$limit'},
    ),
    headers: headers,
  );
  return _decode(res);
}

/// Resumo de uso (visitas, prêmios, progresso).
Future<Map<String, dynamic>> fetchMyStats() async {
  final headers = await customerAuthHeaders();
  final res = await http.get(
    Uri.parse('$apiBaseUrl/me/stats'),
    headers: headers,
  );
  return _decode(res);
}

Future<Map<String, dynamic>> setMembershipFavorite({
  required String businessId,
  required bool isFavorite,
}) async {
  final headers = await customerAuthHeaders();
  final res = await http.patch(
    Uri.parse('$apiBaseUrl/me/memberships/$businessId/favorite'),
    headers: headers,
    body: jsonEncode({'isFavorite': isFavorite}),
  );
  return _decode(res);
}

Future<Map<String, dynamic>> putDeviceToken({
  required String token,
  required String platform,
}) async {
  final headers = await customerAuthHeaders();
  final res = await http.put(
    Uri.parse('$apiBaseUrl/me/device-token'),
    headers: headers,
    body: jsonEncode({
      'token': token,
      'platform': platform,
    }),
  );
  return _decode(res);
}

Future<Map<String, dynamic>> deleteMyAccount() async {
  final headers = await customerAuthHeaders();
  final res = await http.delete(
    Uri.parse('$apiBaseUrl/me/customer'),
    headers: headers,
  );
  return _decode(res);
}

Future<Map<String, dynamic>> deleteDeviceToken(String token) async {
  final headers = await customerAuthHeaders();
  final res = await http.delete(
    Uri.parse('$apiBaseUrl/me/device-token'),
    headers: headers,
    body: jsonEncode({'token': token}),
  );
  return _decode(res);
}
