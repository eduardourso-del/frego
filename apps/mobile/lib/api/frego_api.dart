import 'dart:async';
import 'dart:convert';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;

import '../config/app_config.dart';
import 'api_client.dart';

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
  final res = await apiClient.get(
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
  bool? boasVindasEnabled,
  bool? entradaEnabled,
  String? city,
  String? state,
}) async {
  final headers = await customerAuthHeaders();
  final res = await apiClient.patch(
    Uri.parse('$apiBaseUrl/me/customer'),
    headers: headers,
    body: jsonEncode({
      if (displayName != null) 'displayName': displayName,
      'onboardingCompleted': onboardingCompleted,
      if (clearBirthday) 'birthday': null,
      if (!clearBirthday && birthday != null) 'birthday': birthday,
      if (notificationsEnabled != null)
        'notificationsEnabled': notificationsEnabled,
      if (boasVindasEnabled != null) 'boasVindasEnabled': boasVindasEnabled,
      if (entradaEnabled != null) 'entradaEnabled': entradaEnabled,
      if (city != null) 'city': city,
      if (state != null) 'state': state,
    }),
  );
  return _decode(res);
}

Future<List<Map<String, dynamic>>> fetchHomeCities() async {
  final headers = await customerAuthHeaders();
  final res = await apiClient.get(
    Uri.parse('$apiBaseUrl/me/cities'),
    headers: headers,
  );
  final body = _decode(res);
  return (body['cities'] as List<dynamic>? ?? [])
      .cast<Map<String, dynamic>>();
}

Future<Map<String, dynamic>> locateCity({
  required double latitude,
  required double longitude,
}) async {
  final headers = await customerAuthHeaders();
  final res = await apiClient.get(
    Uri.parse('$apiBaseUrl/me/exploration/locate').replace(
      queryParameters: {
        'lat': latitude.toString(),
        'lng': longitude.toString(),
      },
    ),
    headers: headers,
  );
  return _decode(res);
}

Map<String, String>? _positionQuery(double? latitude, double? longitude) {
  if (latitude == null || longitude == null) return null;
  return {
    'lat': latitude.toString(),
    'lng': longitude.toString(),
  };
}

Future<Map<String, dynamic>> fetchExploration({
  double? latitude,
  double? longitude,
}) async {
  final headers = await customerAuthHeaders();
  final res = await apiClient.get(
    Uri.parse('$apiBaseUrl/me/exploration').replace(
      queryParameters: _positionQuery(latitude, longitude),
    ),
    headers: headers,
  );
  return _decode(res);
}

Future<Map<String, dynamic>> setBrowseCity({
  required String city,
  required String state,
}) async {
  final headers = await customerAuthHeaders();
  final res = await apiClient.put(
    Uri.parse('$apiBaseUrl/me/exploration/city'),
    headers: headers,
    body: jsonEncode({'city': city, 'state': state}),
  );
  return _decode(res);
}

Future<Map<String, dynamic>> fetchExplorationPlace({
  required String businessId,
  required String city,
  required String state,
  double? latitude,
  double? longitude,
}) async {
  final headers = await customerAuthHeaders();
  final res = await apiClient.get(
    Uri.parse('$apiBaseUrl/me/exploration/businesses/$businessId').replace(
      queryParameters: {
        'city': city,
        'state': state,
        ...?_positionQuery(latitude, longitude),
      },
    ),
    headers: headers,
  );
  return _decode(res);
}

Future<Map<String, dynamic>> setFavorite({
  required String businessId,
  required bool isFavorite,
}) async {
  final headers = await customerAuthHeaders();
  final res = await apiClient.patch(
    Uri.parse('$apiBaseUrl/me/favorites/$businessId'),
    headers: headers,
    body: jsonEncode({'isFavorite': isFavorite}),
  );
  return _decode(res);
}

Future<Map<String, dynamic>> fetchMyMemberships({
  double? latitude,
  double? longitude,
}) async {
  final headers = await customerAuthHeaders();
  final res = await apiClient.get(
    Uri.parse('$apiBaseUrl/me/memberships').replace(
      queryParameters: _positionQuery(latitude, longitude),
    ),
    headers: headers,
  );
  return _decode(res);
}

Future<Map<String, dynamic>> fetchMyWallet({
  String? businessId,
  double? latitude,
  double? longitude,
}) async {
  final headers = await customerAuthHeaders();
  final query = <String, String>{
    ...?_positionQuery(latitude, longitude),
  };
  if (businessId != null) query['businessId'] = businessId;
  final uri = query.isEmpty
      ? Uri.parse('$apiBaseUrl/me/wallet')
      : Uri.parse('$apiBaseUrl/me/wallet').replace(queryParameters: query);
  final res = await apiClient.get(uri, headers: headers);
  return _decode(res);
}

Future<Map<String, dynamic>> redeemCampaign({
  required String businessId,
  required String campaignId,
}) async {
  final headers = await customerAuthHeaders();
  final res = await apiClient.post(
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
  final res = await apiClient.get(
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
  final res = await apiClient.get(
    Uri.parse('$apiBaseUrl/me/stats'),
    headers: headers,
  );
  return _decode(res);
}

Future<Map<String, dynamic>> setMembershipFavorite({
  required String businessId,
  required bool isFavorite,
}) {
  return setFavorite(businessId: businessId, isFavorite: isFavorite);
}

Future<Map<String, dynamic>> putDeviceToken({
  required String token,
  required String platform,
}) async {
  final headers = await customerAuthHeaders();
  final res = await apiClient.put(
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
  final res = await apiClient.delete(
    Uri.parse('$apiBaseUrl/me/customer'),
    headers: headers,
    // Auth headers always set application/json. Fastify 400s an empty body.
    body: '{}',
  );
  return _decode(res);
}

Future<Map<String, dynamic>> fetchMyConvite(String businessId) async {
  final headers = await customerAuthHeaders();
  final res = await apiClient.get(
    Uri.parse('$apiBaseUrl/me/businesses/$businessId/convite'),
    headers: headers,
  );
  return _decode(res);
}

Future<Map<String, dynamic>> submitMyConvite({
  required String conviteId,
  required List<Map<String, dynamic>> answers,
  String? note,
}) async {
  final headers = await customerAuthHeaders();
  final res = await apiClient.post(
    Uri.parse('$apiBaseUrl/me/convites/$conviteId/submit'),
    headers: headers,
    body: jsonEncode({
      'answers': answers,
      'note': ?note,
    }),
  );
  final body = jsonDecode(res.body);
  if (body is! Map<String, dynamic>) {
    throw Exception('Erro na API');
  }
  if (res.statusCode >= 400) {
    throw Exception(
      body['message'] as String? ?? body['error'] as String? ?? 'Erro na API',
    );
  }
  return body;
}

Future<Map<String, dynamic>> deleteDeviceToken(String token) async {
  final headers = await customerAuthHeaders();
  final res = await apiClient.delete(
    Uri.parse('$apiBaseUrl/me/device-token'),
    headers: headers,
    body: jsonEncode({'token': token}),
  );
  return _decode(res);
}
